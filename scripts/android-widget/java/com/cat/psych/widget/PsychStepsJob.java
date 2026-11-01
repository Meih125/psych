package com.cat.psych.widget;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.StepsRecord;
import android.os.Build;
import android.os.OutcomeReceiver;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * Background step sync for the widgets (Settings > Step sync > Sync in the background).
 * About every 15 minutes Android runs this job, even with Psych closed: it reads today's steps from Health Connect
 * and updates the Steps tiles on the widgets (count, bar, the reward waiting, "Synced … ago"). It never pays anything:
 * the app reads the steps itself and does the real sums when it opens.
 * Needs Android 14+ (Health Connect built in) and the "read in the background" permission; otherwise it does nothing.
 */
public class PsychStepsJob extends JobService {
    static final int JOB_ID = 4711;
    static final String READ_STEPS = "android.permission.health.READ_STEPS";
    static final String READ_BG = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND";

    // ---------- turning it on and off (from PsychWidgetPlugin) ----------
    static boolean supported() { return Build.VERSION.SDK_INT >= 34; }

    static boolean allowed(Context c) {
        return supported() && c.checkSelfPermission(READ_STEPS) == PackageManager.PERMISSION_GRANTED
            && c.checkSelfPermission(READ_BG) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean on(Context c) { return PsychWidgetProvider.prefs(c).getBoolean("bg_steps", false); }

    /** Make sure the job is scheduled when it's on (and allowed), cancelled when it's off. Safe to call often. */
    static void schedule(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null) return;
        if (!on(c) || !allowed(c)) { js.cancel(JOB_ID); return; }
        if (js.getPendingJob(JOB_ID) != null) return;
        js.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(c, PsychStepsJob.class))
            .setPeriodic(15 * 60 * 1000L)          // Android's shortest repeat; it may run a little later to save battery
            .setPersisted(true)                    // keeps going after a restart
            .setRequiresBatteryNotLow(true)        // battery saving: skipped while the phone's battery is low
            .build());
    }

    // ---------- the job ----------
    @Override
    public boolean onStartJob(JobParameters params) {
        if (!allowed(this) || !on(this)) return false;
        try {
            Reader.today(this, steps -> { apply(this, steps); jobFinished(params, false); },
                () -> jobFinished(params, false));
            return true;   // still working: the answer comes back later
        } catch (Throwable e) { return false; }
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }   // stopped early: try again later

    /** Health Connect's own API (Android 14+), kept in its own class so older phones never load it. */
    static class Reader {
        interface Done { void steps(long n); }
        static void today(Context c, Done done, Runnable fail) {
            HealthConnectManager hc = c.getSystemService(HealthConnectManager.class);
            if (hc == null) { fail.run(); return; }
            TimeInstantRangeFilter range = new TimeInstantRangeFilter.Builder()
                .setStartTime(Instant.ofEpochMilli(midnight(0))).setEndTime(Instant.now()).build();
            AggregateRecordsRequest<Long> req = new AggregateRecordsRequest.Builder<Long>(range)
                .addAggregationType(StepsRecord.STEPS_COUNT_TOTAL).build();
            hc.aggregate(req, c.getMainExecutor(), new OutcomeReceiver<AggregateRecordsResponse<Long>, HealthConnectException>() {
                @Override public void onResult(AggregateRecordsResponse<Long> r) {
                    Long n = r.get(StepsRecord.STEPS_COUNT_TOTAL);
                    done.steps(n == null ? 0 : n);
                }
                @Override public void onError(HealthConnectException e) { fail.run(); }
            });
        }
    }

    // ---------- updating the widgets' Steps tiles ----------
    static long midnight(int addDays) {
        Calendar k = Calendar.getInstance();
        k.set(Calendar.HOUR_OF_DAY, 0); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        k.add(Calendar.DAY_OF_MONTH, addDays);
        return k.getTimeInMillis();
    }

    static String dayKey() {
        Calendar k = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1, k.get(Calendar.DAY_OF_MONTH));
    }

    /** "1,280" below 10,000; "12.34k", "5.55M" above (rounded down), like cyNum in app.js */
    static String num(long v) {
        if (v < 10000) return String.format(Locale.US, "%,d", v);
        String[] u = { "k", "M", "B" }; double x = v; int i = -1;
        while (x >= 1000 && i < 2) { x /= 1000; i++; }
        return String.format(Locale.US, "%.2f", Math.floor(x * 100) / 100) + u[i];
    }

    static void apply(Context c, long steps) {
        steps = Math.max(0, Math.min(500000, steps));
        SharedPreferences p = PsychWidgetProvider.prefs(c);
        try {
            JSONObject snap = new JSONObject(p.getString("snapshot", "{}"));
            JSONArray ws = snap.optJSONArray("widgets");
            if (ws == null) return;
            String today = dayKey();
            long now = System.currentTimeMillis();
            List<JSONObject> boards = new ArrayList<>();
            boolean changed = false;   // battery: the home screen is only redrawn when the steps (or the day) changed, or an hour went by
            for (int i = 0; i < ws.length(); i++) {
                JSONObject w = ws.getJSONObject(i);
                List<JSONObject> list = PsychWidgetProvider.slots(w);
                for (JSONObject s : list) {
                    JSONObject bg = s.optJSONObject("bg");
                    if (bg == null) continue;
                    if (bg.optLong("steps", -1) != steps || !today.equals(bg.optString("day"))) changed = true;
                    update(s, steps, today);
                }
                JSONObject b = w.optJSONObject("board");
                JSONObject st = b == null ? null : b.optJSONObject("steps");
                if (st != null) { if (now - st.optLong("drawnAt", 0) > 3600000L) changed = true; st.put("syncAt", now); boards.add(st); }
            }
            if (changed) for (JSONObject st : boards) st.put("drawnAt", now);   // "Synced … ago" stays within the hour
            p.edit().putString("snapshot", snap.toString()).apply();
            if (changed) PsychWidgetProvider.refreshAll(c, true);
        } catch (Exception ignored) {}
    }

    /** One Steps tile: today's count and bar, and the reward waiting (earlier days + today's new chunks). */
    static void update(JSONObject s, long steps, String today) throws Exception {
        JSONObject bg = s.getJSONObject("bg");
        long chunk = Math.max(1, bg.optLong("chunk", 100)), paid = bg.optLong("paid"), goal = bg.optLong("goal");
        long otherXp = bg.optLong("otherXp"), otherGold = bg.optLong("otherGold"), otherDays = bg.optLong("otherDays");
        if (!today.equals(bg.optString("day"))) {
            // a new day since the app last opened: what was left of that day still waits, today starts from zero
            long u = Math.max(0, bg.optLong("steps") / chunk - paid / chunk);
            if (u > 0) { otherXp += u * bg.optLong("xpPer"); otherGold += u * bg.optLong("goldPer"); otherDays++; }
            bg.put("day", today).put("paid", 0).put("otherXp", otherXp).put("otherGold", otherGold).put("otherDays", otherDays);
            paid = 0;
        }
        bg.put("steps", steps);
        long units = Math.max(0, steps / chunk - paid / chunk);
        long xp = otherXp + units * bg.optLong("xpPer"), gold = otherGold + units * bg.optLong("goldPer"), days = otherDays + (units > 0 ? 1 : 0);
        String count = num(steps) + (goal > 0 ? " / " + num(goal) : "");
        s.put("text", count).put("sub", count).put("pct", goal > 0 ? (int) Math.min(100, steps * 100 / goal) : 0)
         .put("xp", "+" + num(xp)).put("gold", "+" + num(gold)).put("rawXp", xp).put("rawGold", gold)
         .put("done", days == 0).put("tap", days > 0 ? "steps" : "open")
         .put("note", "");
        JSONArray btn = new JSONArray();
        if (days > 0) btn.put(new JSONObject().put("label", "CLAIM").put("act", "steps").put("style", "cy"));
        s.put("btn", btn);
    }
}
