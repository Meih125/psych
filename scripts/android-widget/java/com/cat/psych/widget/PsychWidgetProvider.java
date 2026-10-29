package com.cat.psych.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * Draws Psych home-screen widgets from the snapshot the app sends (PsychWidgetPlugin.update).
 * Every row is one home-screen cell high: one full quest, or two half quests (a 2-wide widget shows one half quest per row).
 * Tap anywhere on a quest = its main action (claim, +1 orb, add an amount...). Tap the quest's icon, or a finished
 * quest, to open the app. Taps are queued for the app (it applies them when it opens) and shown on the widget at once.
 * The 4x4 is different: the whole Quests page with a tab per group and a scrolling list (buildBoard, PsychBoardService).
 */
public abstract class PsychWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "psych_widget";
    public static final String ACTION_TAP = "com.cat.psych.widget.TAP";
    public static final String ACTION_PINNED = "com.cat.psych.widget.PINNED";
    public static final String ACTION_TAB = "com.cat.psych.widget.TAB";

    protected abstract String size();

    public static final Class<?>[] PROVIDERS = { Widget2x1.class, Widget4x1.class, Widget2x2.class, Widget4x2.class, Widget4x4.class };
    public static final String[] SIZES = { "2x1", "4x1", "2x2", "4x2", "4x4" };

    boolean isBoard() { return "4x4".equals(size()); }

    public static Class<?> providerFor(String size) {
        for (int i = 0; i < SIZES.length; i++) if (SIZES[i].equals(size)) return PROVIDERS[i];
        return Widget4x1.class;
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Redraw every Psych widget on the home screen. */
    public static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> cls : PROVIDERS) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, cls));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(c, cls).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(i);
        }
    }

    void redraw(Context c, AppWidgetManager m, int id) {
        try {
            if (isBoard()) { m.updateAppWidget(id, buildBoard(c, m, id)); m.notifyAppWidgetViewDataChanged(id, id(c, "b_list")); }
            else m.updateAppWidget(id, build(c, m, id));
        } catch (Exception ignored) {}
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) redraw(c, m, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle opts) {
        redraw(c, m, id);   // resized: redraw the orbs to fit
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        SharedPreferences.Editor e = prefs(c).edit();
        for (int id : ids) { e.remove("map_" + id); e.remove("tab_" + id); }
        e.apply();
    }

    @Override
    public void onReceive(Context c, Intent in) {
        String a = in.getAction();
        if (ACTION_PINNED.equals(a)) {
            int id = in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            String cfg = in.getStringExtra("configId");
            if (id != -1 && cfg != null) prefs(c).edit().putString("map_" + id, cfg).apply();
            refreshAll(c);
            return;
        }
        if (ACTION_TAB.equals(a)) {   // 4x4: show another group
            int id = in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            String key = in.getStringExtra("tab");
            if (id != -1 && key != null) { prefs(c).edit().putString("tab_" + id, key).apply(); redraw(c, AppWidgetManager.getInstance(c), id); }
            return;
        }
        if (ACTION_TAP.equals(a)) {
            handleTap(c, in.getStringExtra("qid"), in.getStringExtra("act"), null);
            refreshAll(c);
            return;
        }
        super.onReceive(c, in);
    }

    // ---------- taps: queue for the app, update the widget straight away ----------
    static void handleTap(Context c, String qid, String act, Double value) {
        if (qid == null || act == null) return;
        SharedPreferences p = prefs(c);
        try {
            JSONArray q = new JSONArray(p.getString("actions", "[]"));
            JSONObject e = new JSONObject().put("qid", qid).put("act", act).put("t", System.currentTimeMillis());
            if (value != null) e.put("v", value.doubleValue());
            q.put(e);
            JSONObject snap = new JSONObject(p.getString("snapshot", "{}"));
            JSONArray ws = snap.optJSONArray("widgets");
            long addXp = 0, addGold = 0;
            if (ws != null) {
                for (int i = 0; i < ws.length(); i++)
                    for (JSONObject s : slots(ws.getJSONObject(i))) {
                        if (!qid.equals(s.optString("qid"))) continue;
                        if ("claim".equals(act) && !s.optBoolean("done") && addXp == 0 && addGold == 0) { addXp = s.optLong("rawXp"); addGold = s.optLong("rawGold"); }
                        applyLocally(s, act, value);
                    }
                if (addXp > 0 || addGold > 0) for (int i = 0; i < ws.length(); i++) {
                    JSONObject b = ws.getJSONObject(i).optJSONObject("board");
                    if (b != null) addToHeader(b, addXp, addGold);
                }
            }
            p.edit().putString("actions", q.toString()).putString("snapshot", snap.toString()).apply();
        } catch (Exception ignored) {}
    }

    /** Every quest a widget shows: its spots, or for the 4x4 the steps and every tile of every tab. */
    static List<JSONObject> slots(JSONObject w) {
        List<JSONObject> out = new ArrayList<>();
        addRows(out, w.optJSONArray("rows"));
        JSONObject b = w.optJSONObject("board");
        if (b != null) {
            JSONObject st = b.optJSONObject("steps");
            if (st != null) out.add(st);
            JSONArray gs = b.optJSONArray("groups");
            if (gs != null) for (int i = 0; i < gs.length(); i++) { JSONObject g = gs.optJSONObject(i); if (g != null) addRows(out, g.optJSONArray("rows")); }
        }
        return out;
    }

    static void addRows(List<JSONObject> out, JSONArray rows) {
        if (rows == null) return;
        for (int r = 0; r < rows.length(); r++) {
            JSONArray row = rows.optJSONArray(r);
            if (row == null) continue;
            for (int k = 0; k < row.length(); k++) { JSONObject s = row.optJSONObject(k); if (s != null) out.add(s); }
        }
    }

    static JSONObject btn(String label, String act, String style) throws Exception {
        return new JSONObject().put("label", label).put("act", act).put("style", style);
    }

    // ---------- the 4x4 header after a widget claim (the app redoes it exactly when it opens) ----------
    // keep in step with xpToNext / levelReward / levelInfo in app.js
    static long xpToNext(int L) { long base = 100 + 25L * (L - 1); return L % 10 == 9 ? Math.round(base * 1.5 / 5) * 5 : base; }
    static long levelReward(int L) { if (L < 2) return 0; int band = (L - 1) / 10, k = L - band * 10; return k == 10 ? 150 + 50L * band : 10L * k + 5L * band; }
    /** { level, XP into it, XP it needs } */
    static long[] levelInfo(long total) {
        long r = Math.min(1000000000L, Math.max(0, total)); int L = 1;
        while (r >= xpToNext(L)) { r -= xpToNext(L); L++; }
        return new long[] { L, r, xpToNext(L) };
    }
    static void addToHeader(JSONObject b, long addXp, long addGold) throws Exception {
        long xp = b.optLong("totalXp"), gold = b.optLong("totalGold") + addGold;
        long[] before = levelInfo(xp), after = levelInfo(xp + addXp);
        for (int L = (int) before[0] + 1; L <= after[0]; L++) gold += levelReward(L);   // gold for each level reached now, once
        b.put("totalXp", xp + addXp).put("totalGold", gold).put("lv", after[0])
         .put("xpPct", after[2] > 0 ? (int) Math.min(100, after[1] * 100 / after[2]) : 0)
         .put("gold", String.format(Locale.US, "%,d", gold));
    }

    static long nextMidnight() {
        Calendar k = Calendar.getInstance();
        k.set(Calendar.HOUR_OF_DAY, 0); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        k.add(Calendar.DAY_OF_MONTH, 1);
        return k.getTimeInMillis();
    }

    static String num(double v) { return v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(Math.round(v * 100) / 100.0); }

    static void applyLocally(JSONObject s, String act, Double value) throws Exception {
        JSONArray b = new JSONArray();
        String kind = s.optString("kind");
        if ("claim".equals(act)) {
            if ("scaling".equals(kind)) {
                int n = s.optInt("segs") + 1;                       // claims this period, now including this one
                double f = Math.pow(1 + s.optDouble("growth", 0) / 100.0, n);   // the next claim pays (1+g)^n of the base
                int up = (int) Math.round((f - 1) * 100);
                long nx = Math.round(s.optInt("baseXp") * f), ng = Math.round(s.optInt("baseGold") * f);
                s.put("segs", n).put("xp", "+" + nx).put("gold", "+" + ng).put("rawXp", nx).put("rawGold", ng)
                 .put("note", "Claimed \u00D7" + n + (up > 0 ? " \u00B7 Next pays +" + up + "%" : ""));
                return;
            }
            if ("avoid".equals(kind)) b.put(btn("SLIP", "slip", "red"));
            b.put(btn("DONE", "", "ok"));
            s.put("btn", b).put("done", true).put("tap", "open").put("doneUntil", nextMidnight());
        } else if ("hit".equals(act)) {
            int n = s.optInt("need", 1), h = Math.min(n, s.optInt("hits") + 1);
            s.put("hits", h).put("tap", h >= n ? "claim" : "hit");
            b.put(h >= n ? btn("CLAIM", "claim", "or") : btn(h + "/" + n, "hit", "cy"));
            s.put("btn", b);
        } else if ("slip".equals(act)) {
            b.put(btn("SLIPPED", "", "red"));
            s.put("btn", b).put("done", true).put("tap", "open").put("streak", "0×").put("mult", "").put("doneUntil", nextMidnight());
        } else if ("tally".equals(act) && value != null) {
            double chunk = s.optDouble("chunk", 1), carry = s.optDouble("carry", 0) + value, added = s.optDouble("added", 0) + value;
            int units = (int) Math.floor(carry / chunk + 1e-9), pend = s.optInt("pend", 0) + units;
            carry = carry - units * chunk;
            String amt = s.optBoolean("pre") ? s.optString("unit") + num(added) : num(added) + " " + s.optString("unit");
            s.put("carry", carry).put("added", added).put("pend", pend)
             .put("xp", "+" + (pend * s.optInt("xpPer"))).put("gold", "+" + (pend * s.optInt("goldPer")))
             .put("sub", amt.trim() + " added · reward waiting").put("note", "added when the app opens");
        } else if ("record".equals(act) && value != null) {
            b.put(btn("DONE", "", "ok"));
            s.put("btn", b).put("done", true).put("tap", "open").put("sub", num(value) + " " + s.optString("unit") + " recorded");
        } else if ("steps".equals(act)) {
            s.put("btn", b).put("done", true).put("tap", "open").put("note", "claimed");
        } else if ("pairA".equals(act) || "pairB".equals(act)) {
            JSONObject h = s.optJSONObject("pairA".equals(act) ? "pa" : "pb");
            if (h != null) h.put("done", true);
            int d = 0;
            JSONObject pa = s.optJSONObject("pa"), pb = s.optJSONObject("pb");
            if (pa != null && pa.optBoolean("done")) d++;
            if (pb != null && pb.optBoolean("done")) d++;
            s.put("streak", d + "/2");
            if (d == 2) s.put("done", true).put("note", "bonus earned");
        }
    }

    // ---------- drawing ----------
    JSONObject configFor(Context c, int appWidgetId) { return findConfig(c, appWidgetId, size()); }

    static JSONObject findConfig(Context c, int appWidgetId, String size) {
        try {
            JSONObject snap = new JSONObject(prefs(c).getString("snapshot", "{}"));
            JSONArray ws = snap.optJSONArray("widgets");
            if (ws == null) return null;
            String want = prefs(c).getString("map_" + appWidgetId, null);
            JSONObject sameSize = null;
            for (int i = 0; i < ws.length(); i++) {
                JSONObject w = ws.getJSONObject(i);
                if (want != null && want.equals(w.optString("id"))) return w;
                if (sameSize == null && size.equals(w.optString("size"))) sameSize = w;
            }
            return sameSize;   // added from the launcher's widget list: use the first one of this size
        } catch (Exception e) { return null; }
    }

    PendingIntent openApp(Context c) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent();
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** What a tap does: open the app, ask for a number (tally / record), or queue the action. */
    PendingIntent action(Context c, JSONObject s, String act, int req) {
        if (act == null || act.isEmpty() || "open".equals(act)) return openApp(c);
        if ("tally".equals(act) || "record".equals(act)) {
            Intent i = new Intent(c, WidgetInputActivity.class)
                .putExtra("qid", s.optString("qid")).putExtra("act", act).putExtra("name", s.optString("name")).putExtra("unit", s.optString("unit"))
                .putExtra("pre", s.optBoolean("pre")).putExtra("chunk", s.optDouble("chunk", 0)).putExtra("carry", s.optDouble("carry", 0))
                .putExtra("xpPer", s.optInt("xpPer")).putExtra("goldPer", s.optInt("goldPer"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        Intent i = new Intent(c, getClass()).setAction(ACTION_TAP).putExtra("qid", s.optString("qid")).putExtra("act", act);
        return PendingIntent.getBroadcast(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** What tapping a view does. Home-screen tiles get their own intent; the 4x4's list rows override this (PsychBoardService). */
    void click(Context c, RemoteViews rv, int vid, JSONObject s, String act, int req) {
        if (vid != 0) rv.setOnClickPendingIntent(vid, action(c, s, act, req));
    }

    static int id(Context c, String name) { return c.getResources().getIdentifier(name, "id", c.getPackageName()); }

    RemoteViews build(Context c, AppWidgetManager m, int appWidgetId) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), c.getResources().getIdentifier("psych_widget", "layout", c.getPackageName()));
        rv.setOnClickPendingIntent(id(c, "root"), openApp(c));
        JSONObject w = configFor(c, appWidgetId);
        JSONArray rows = w == null ? null : w.optJSONArray("rows");
        if (rows == null || rows.length() == 0) { rv.setViewVisibility(id(c, "msg"), View.VISIBLE); return rv; }
        boolean two = w.optInt("width", 4) == 2;
        float dens = c.getResources().getDisplayMetrics().density;
        int widthDp = 250;
        try { Bundle o = m.getAppWidgetOptions(appWidgetId); int mw = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0); if (mw > 0) widthDp = mw; } catch (Exception ignored) {}
        try {
            for (int r = 0; r < 2; r++) {
                String p = "r" + r;
                if (r >= rows.length()) { rv.setViewVisibility(id(c, p), View.GONE); continue; }
                rv.setViewVisibility(id(c, p), View.VISIBLE);
                JSONArray row = rows.getJSONArray(r);
                vis(rv, id(c, p + "f"), false); vis(rv, id(c, p + "a"), false); vis(rv, id(c, p + "b"), false);
                if (row.length() == 2) {
                    int halfW = (widthDp - 6) / 2;
                    tile(c, rv, p + "a", row.optJSONObject(0), appWidgetId, r * 10 + 1, true, halfW, dens);
                    tile(c, rv, p + "b", row.optJSONObject(1), appWidgetId, r * 10 + 2, true, halfW, dens);
                } else if (two) {
                    tile(c, rv, p + "a", row.optJSONObject(0), appWidgetId, r * 10 + 1, true, widthDp, dens);
                } else {
                    tile(c, rv, p + "f", row.optJSONObject(0), appWidgetId, r * 10, false, widthDp, dens);
                }
            }
        } catch (Exception ignored) {}
        return rv;
    }

    /** Target orbs drawn to fit: as big as the space allows (up to 14dp), filled = done. */
    static Bitmap orbBitmap(int hits, int need, int availDp, float dens) {
        need = Math.max(1, need);
        float gap = 0.35f;
        float d = Math.min(14f, availDp / (need + (need - 1) * gap));
        d = Math.max(4f, d);
        int dpx = Math.max(4, Math.round(d * dens)), gpx = Math.round(d * gap * dens), stroke = Math.max(2, Math.round(1.6f * dens));
        int w = need * dpx + (need - 1) * gpx + stroke, h = dpx + stroke;
        Bitmap bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG); fill.setColor(hits >= need ? Color.parseColor("#FFD27A") : Color.parseColor("#2EE6D6"));
        Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG); ring.setStyle(Paint.Style.STROKE); ring.setStrokeWidth(stroke); ring.setColor(fill.getColor());
        float r = dpx / 2f;
        for (int i = 0; i < need; i++) {
            float cx = stroke / 2f + r + i * (dpx + gpx), cy = stroke / 2f + r;
            if (i < hits) cv.drawCircle(cx, cy, r, fill); else cv.drawCircle(cx, cy, r - stroke / 2f, ring);
        }
        return bm;
    }

    /** Recurring: one rounded segment per claim this week (7 shown), filled in red like the app. */
    static Bitmap segBitmap(int n, int max, int widthDp, float dens) {
        max = Math.max(1, max);
        int w = Math.max(10, Math.round(widthDp * dens)), h = Math.max(4, Math.round(6 * dens)), gap = Math.round(4 * dens);
        Bitmap bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Paint on = new Paint(Paint.ANTI_ALIAS_FLAG); on.setColor(Color.parseColor("#FF5A5A"));
        Paint off = new Paint(Paint.ANTI_ALIAS_FLAG); off.setColor(0x14FFFFFF);
        float sw = (w - gap * (max - 1)) / (float) max, rad = h / 2f;
        for (int i = 0; i < max; i++) {
            float x = i * (sw + gap);
            cv.drawRoundRect(new android.graphics.RectF(x, 0, x + sw, h), rad, rad, i < n ? on : off);
        }
        return bm;
    }

    static JSONObject first(JSONArray row) {
        for (int i = 0; i < row.length(); i++) { JSONObject s = row.optJSONObject(i); if (s != null) return s; }
        return null;
    }

    // RemoteViews helpers that skip views a tile doesn't have (half tiles have no note / pair row)
    static void vis(RemoteViews rv, int id, boolean on) { if (id != 0) rv.setViewVisibility(id, on ? View.VISIBLE : View.GONE); }
    static void text(RemoteViews rv, int id, String t) { if (id != 0) rv.setTextViewText(id, t); }

    /** One quest, drawn like its tile in the app. */
    void tile(Context c, RemoteViews rv, String p, JSONObject s, int wid, int slot, boolean half, int tileDp, float dens) throws Exception {
        int box = id(c, p);
        if (s == null) { rv.setViewVisibility(box, View.INVISIBLE); return; }   // an empty spot keeps its space
        rv.setViewVisibility(box, View.VISIBLE);
        // after the quest's reset time a finished quest is ready again
        long until = s.optLong("doneUntil", 0);
        JSONObject reset = s.optJSONObject("reset");
        JSONArray buttons = s.optJSONArray("btn");
        boolean done = s.optBoolean("done");
        String tap = s.optString("tap", "claim");
        int hits = s.optInt("hits", 0);
        if (until > 0 && System.currentTimeMillis() >= until && reset != null) {
            buttons = reset.optJSONArray("btn"); done = false; tap = reset.optString("tap", "claim"); hits = reset.optInt("hits", hits);
        }
        int color = parse(s.optString("color"), Color.parseColor("#FF8A45"));
        int ic = id(c, p + "_ic");
        int icon = c.getResources().getIdentifier("pw_k_" + s.optString("kind", "standard"), "drawable", c.getPackageName());
        if (icon == 0) icon = c.getResources().getIdentifier("pw_k_standard", "drawable", c.getPackageName());
        rv.setImageViewResource(ic, icon);
        rv.setInt(ic, "setColorFilter", color);
        rv.setInt(ic, "setBackgroundColor", (color & 0x00FFFFFF) | 0x26000000);
        text(rv, id(c, p + "_title"), s.optString("name"));
        String strk = s.optString("streak"), mlt = s.optString("mult");
        text(rv, id(c, p + "_streak"), strk);
        vis(rv, id(c, p + "_streak"), !strk.isEmpty());
        rv.setTextColor(id(c, p + "_streak"), parse(s.optString("streakColor"), Color.WHITE));
        text(rv, id(c, p + "_mult"), mlt);
        vis(rv, id(c, p + "_mult"), !mlt.isEmpty());
        rv.setTextColor(id(c, p + "_mult"), parse(s.optString("streakColor"), Color.parseColor("#F5C542")));   // the +% in its streak's colour
        text(rv, id(c, p + "_xp"), s.optString("xp"));
        text(rv, id(c, p + "_gold"), s.optString("gold"));
        // line under the name (steps), the steps bar, the note after the rewards (totals, best, bonus)
        String sub = s.optString("sub"), note = s.optString("note");
        text(rv, id(c, p + "_sub"), sub);
        vis(rv, id(c, p + "_sub"), !sub.isEmpty());
        int bar = id(c, p + "_bar");
        if (s.has("pct")) { rv.setProgressBar(bar, 100, Math.max(0, Math.min(100, s.optInt("pct"))), false); vis(rv, bar, true); } else vis(rv, bar, false);
        int nt = id(c, p + "_note");
        text(rv, nt, note);
        // recurring: claims this week as segments across the tile
        int segs = id(c, p + "_segs");
        if (segs != 0 && s.has("segs")) { rv.setImageViewBitmap(segs, segBitmap(s.optInt("segs"), s.optInt("segMax", 7), Math.max(80, tileDp - 26), dens)); vis(rv, segs, true); } else vis(rv, segs, false);
        // target orbs, drawn to fit the space they get
        int orbs = id(c, p + "_orbs");
        if (s.has("need")) {
            int avail = half ? Math.max(30, tileDp - 24) : Math.max(60, (tileDp - 26) / 2 - 10);
            rv.setImageViewBitmap(orbs, orbBitmap(hits, s.optInt("need", 1), avail, dens));
            vis(rv, orbs, true);
        } else vis(rv, orbs, false);
        // pair: its two halves as boxes, each tappable
        int pair = id(c, p + "_pair");
        JSONObject pa = s.optJSONObject("pa"), pb = s.optJSONObject("pb");
        if (pair != 0 && pa != null && pb != null) {
            vis(rv, pair, true);
            String[][] hs = { { "_pa", "pairA" }, { "_pb", "pairB" } };
            JSONObject[] ho = { pa, pb };
            for (int k = 0; k < 2; k++) {
                String q = p + hs[k][0];
                boolean hd = ho[k].optBoolean("done");
                int t = id(c, q + "_t");
                rv.setTextViewText(t, (hd ? "\u25CF  " : "\u25CB  ") + ho[k].optString("label"));
                rv.setTextColor(t, hd ? 0xFF7F9593 : 0xFFF2F7F6);
                rv.setTextViewText(id(c, q + "_x"), ho[k].optString("xp"));
                rv.setTextViewText(id(c, q + "_g"), ho[k].optString("gold"));
                for (String part : new String[] { "_gi", "_x", "_ci", "_g" }) vis(rv, id(c, q + part), !hd);   // a done half just shows its name
                click(c, rv, id(c, q), s, hd ? "open" : hs[k][1], (wid * 100 + slot * 4 + 3 + k * 40) & 0x7fffffff);
            }
        } else vis(rv, pair, false);
        // bounty: the time left with a clock (at the right of the footer on a full tile, under the name on a half tile); due today / tomorrow = a red tile
        String due = s.optString("due");
        boolean urgent = s.optBoolean("urgent") && !done;
        rv.setInt(box, "setBackgroundResource", c.getResources().getIdentifier(urgent ? "pw_card_red" : "pw_card", "drawable", c.getPackageName()));
        int subV = id(c, p + "_sub"), dueV = id(c, p + "_due");
        if (subV != 0) { rv.setTextColor(subV, 0xFFCFDEDC); rv.setTextViewCompoundDrawables(subV, 0, 0, 0, 0); }
        vis(rv, dueV, false);
        int dv = half ? subV : dueV;
        if (!due.isEmpty() && !done && dv != 0) {
            rv.setTextViewText(dv, due);
            rv.setTextColor(dv, urgent ? 0xFFFF6B5E : 0xFFFF8A45);
            rv.setTextViewCompoundDrawables(dv, c.getResources().getIdentifier(urgent ? "pw_clock_red" : "pw_clock", "drawable", c.getPackageName()), 0, 0, 0);
            rv.setInt(dv, "setCompoundDrawablePadding", Math.round(4 * dens));
            vis(rv, dv, true);
        }
        int nb = buttons == null ? 0 : buttons.length();
        vis(rv, id(c, p + "_rew"), !(half && nb >= 2));
        // a finished quest fades, like on the board
        rv.setTextColor(id(c, p + "_title"), done ? 0x80F2F7F6 : 0xFFF2F7F6);
        rv.setTextColor(id(c, p + "_xp"), done ? 0x808FD9CF : 0xFF8FD9CF);
        rv.setTextColor(id(c, p + "_gold"), done ? 0x80FFC94A : 0xFFFFC94A);
        rv.setInt(ic, "setImageAlpha", done ? 128 : 255);
        // tap anywhere = the main action; the icon (or a finished quest) opens the app
        click(c, rv, box, s, done ? "open" : tap, (wid * 100 + slot * 4) & 0x7fffffff);
        click(c, rv, ic, s, "open", 0);
        String[] ids = { p + "_b1", p + "_b2" };
        int n = buttons == null ? 0 : buttons.length();   // the last button is the main one, the one before it e.g. SLIP
        for (int k = 0; k < 2; k++) {
            int vid = id(c, ids[k]), bi = n - 1 - k;
            if (bi < 0) { rv.setViewVisibility(vid, View.GONE); continue; }
            JSONObject b = buttons.getJSONObject(bi);
            String st = b.optString("style", "or"), act = b.optString("act");
            if (!"ok".equals(st) && !"red".equals(st) && !"cy".equals(st) && !"dim".equals(st)) st = "or";
            rv.setViewVisibility(vid, View.VISIBLE);
            rv.setTextViewText(vid, b.optString("label"));
            rv.setTextColor(vid, Color.parseColor("ok".equals(st) ? "#3FD47A" : "red".equals(st) ? "#FF8A7F" : "cy".equals(st) ? "#2EE6D6" : "dim".equals(st) ? "#6F8482" : "#FF8A45"));
            rv.setInt(vid, "setBackgroundResource", c.getResources().getIdentifier("pw_btn_" + st, "drawable", c.getPackageName()));
            click(c, rv, vid, s, act, (wid * 100 + slot * 4 + 1 + k) & 0x7fffffff);
        }
    }

    // ---------- the 4x4: the whole Quests page ----------
    /** A finished quest whose reset time has passed counts as not done (the widget may be hours older than the app). */
    static boolean doneNow(JSONObject s) {
        long until = s.optLong("doneUntil", 0);
        if (until > 0 && System.currentTimeMillis() >= until && s.optJSONObject("reset") != null) return false;
        return s.optBoolean("done");
    }

    /** A group's done count, like the app's "3/5": counted tiles, plus counted quests it doesn't show (folded follow-ups). */
    static int[] count(JSONObject g) {
        int done = g.optInt("hidDone"), all = g.optInt("hidN");
        List<JSONObject> list = new ArrayList<>();
        addRows(list, g.optJSONArray("rows"));
        for (JSONObject s : list) if (s.optBoolean("counts")) { all++; if (doneNow(s)) done++; }
        return new int[] { done, all };
    }

    /** "4d 8h", "8h 30m" or "12m" */
    static String left(long ms) {
        long m = Math.max(0, ms / 60000), d = m / 1440, h = m % 1440 / 60;
        return d > 0 ? d + "d " + h + "h" : h > 0 ? h + "h " + (m % 60) + "m" : (m % 60) + "m";
    }

    /** The tab this widget shows: the one picked, or the first group (if the picked one is gone). */
    static JSONObject tabOf(Context c, int wid, JSONArray groups) {
        if (groups == null || groups.length() == 0) return null;
        String want = prefs(c).getString("tab_" + wid, null);
        for (int i = 0; i < groups.length(); i++) { JSONObject g = groups.optJSONObject(i); if (g != null && g.optString("key").equals(want)) return g; }
        return groups.optJSONObject(0);
    }

    static int widthDp(AppWidgetManager m, int wid) {
        try { int w = m.getAppWidgetOptions(wid).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0); if (w > 0) return w; } catch (Exception ignored) {}
        return 250;
    }

    /** The done ring: orange arc (green when all done) with "3/8" inside. */
    static Bitmap ringBitmap(int done, int all, float dens) {
        int sz = Math.round(40 * dens);
        Bitmap bm = Bitmap.createBitmap(sz, sz, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        float sw = 4 * dens, in = sw / 2 + dens;
        RectF r = new RectF(in, in, sz - in, sz - in);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG); bg.setStyle(Paint.Style.STROKE); bg.setStrokeWidth(sw); bg.setColor(0x14FFFFFF);
        cv.drawArc(r, 0, 360, false, bg);
        if (all > 0 && done > 0) {
            Paint fg = new Paint(Paint.ANTI_ALIAS_FLAG); fg.setStyle(Paint.Style.STROKE); fg.setStrokeWidth(sw); fg.setStrokeCap(Paint.Cap.ROUND);
            fg.setColor(done >= all ? Color.parseColor("#3FD47A") : Color.parseColor("#FF6B1A"));
            cv.drawArc(r, -90, 360f * Math.min(done, all) / all, false, fg);
        }
        String t = done + "/" + all;
        Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG); tp.setColor(Color.parseColor("#F2F7F6")); tp.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        tp.setTextSize((t.length() <= 3 ? 11 : t.length() == 4 ? 10 : t.length() == 5 ? 8.5f : 7.5f) * dens); tp.setTextAlign(Paint.Align.CENTER);
        cv.drawText(t, sz / 2f, sz / 2f - (tp.descent() + tp.ascent()) / 2, tp);
        return bm;
    }

    static int flagMutable() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0; }

    RemoteViews buildBoard(Context c, AppWidgetManager m, int wid) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), c.getResources().getIdentifier("psych_widget_board", "layout", c.getPackageName()));
        int list = id(c, "b_list");
        rv.setOnClickPendingIntent(id(c, "b_top"), openApp(c));
        rv.setOnClickPendingIntent(id(c, "b_sum"), openApp(c));
        // the scrolling list: rows come from PsychBoardService; a tap on a row goes through WidgetTapActivity
        Intent svc = new Intent(c, PsychBoardService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));   // one list per widget
        rv.setRemoteAdapter(list, svc);
        rv.setEmptyView(list, id(c, "b_empty"));
        Intent tpl = new Intent(c, WidgetTapActivity.class);
        rv.setPendingIntentTemplate(list, PendingIntent.getActivity(c, wid & 0x7fffffff, tpl, PendingIntent.FLAG_UPDATE_CURRENT | flagMutable()));
        float dens = c.getResources().getDisplayMetrics().density;
        JSONObject w = configFor(c, wid), b = w == null ? null : w.optJSONObject("board");
        if (b == null) {
            rv.setTextViewText(id(c, "b_empty"), "Open Psych to load your quests");
            vis(rv, id(c, "b_tabs"), false); vis(rv, id(c, "b_gh"), false);
            return rv;
        }
        rv.setTextViewText(id(c, "b_lv"), "Lv " + b.optInt("lv", 1));
        rv.setProgressBar(id(c, "b_xp"), 100, Math.max(0, Math.min(100, b.optInt("xpPct"))), false);
        rv.setTextViewText(id(c, "b_gold"), b.optString("gold"));
        JSONArray groups = b.optJSONArray("groups");
        // done ring: every group that counts
        int done = 0, all = 0;
        if (groups != null) for (int i = 0; i < groups.length(); i++) {
            JSONObject g = groups.optJSONObject(i);
            if (g == null || !g.optBoolean("count", true)) continue;
            int[] n = count(g); done += n[0]; all += n[1];
        }
        rv.setImageViewBitmap(id(c, "b_ring"), ringBitmap(done, all, dens));
        // time left today, ticking on its own
        long now = System.currentTimeMillis();
        rv.setChronometer(id(c, "b_timer"), SystemClock.elapsedRealtime() + (nextMidnight() - now), null, true);
        rv.setChronometerCountDown(id(c, "b_timer"), true);
        // steps: count, bar, when they last synced, CLAIM for days waiting
        JSONObject st = b.optJSONObject("steps");
        vis(rv, id(c, "b_srow"), st != null); vis(rv, id(c, "b_sbar"), st != null); vis(rv, id(c, "b_sync"), st != null);
        boolean claim = false;
        if (st != null) {
            rv.setTextViewText(id(c, "b_steps"), st.optString("text"));
            rv.setProgressBar(id(c, "b_sbar"), 100, Math.max(0, Math.min(100, st.optInt("pct"))), false);
            long at = st.optLong("syncAt", -1), ago = (now - at) / 60000;
            String sync = at < 0 ? "Sync off" : at == 0 ? "Not synced yet"
                : "Synced " + (ago < 1 ? "just now" : ago < 60 ? ago + " min ago" : ago < 1440 ? Math.round(ago / 60.0) + " h ago" : Math.round(ago / 1440.0) + " d ago");
            rv.setTextViewText(id(c, "b_sync"), sync);
            rv.setTextColor(id(c, "b_sync"), at <= 0 || now - at > 3 * 3600e3 ? Color.parseColor("#FFB44A") : Color.parseColor("#7F9593"));
            JSONArray sb = st.optJSONArray("btn");
            claim = sb != null && sb.length() > 0;
            if (claim) rv.setOnClickPendingIntent(id(c, "b_claim"), action(c, st, "steps", (wid * 100 + 97) & 0x7fffffff));
        }
        vis(rv, id(c, "b_claim"), claim);
        // tabs (DUE, DAILY, CYCLES, OTHERS, whichever have quests), the picked one lit
        JSONObject cur = tabOf(c, wid, groups);
        int ng = groups == null ? 0 : groups.length();
        vis(rv, id(c, "b_tabs"), ng > 0);
        for (int i = 0; i < 6; i++) {
            int tv = id(c, "b_t" + i);
            JSONObject g = i < ng ? groups.optJSONObject(i) : null;
            if (g == null) { vis(rv, tv, false); continue; }
            int[] n = count(g);
            boolean on = cur != null && g.optString("key").equals(cur.optString("key"));
            rv.setViewVisibility(tv, View.VISIBLE);
            rv.setTextViewText(tv, g.optString("tab") + (g.optBoolean("count", true) && n[1] > 0 ? "\n" + n[0] + "/" + n[1] : ""));
            boolean red = g.optBoolean("red");   // DUE: something is due soon
            rv.setTextColor(tv, Color.parseColor(red ? (on ? "#FF8A7F" : "#FF6B5E") : on ? "#2EE6D6" : "#8FA6A3"));
            rv.setInt(tv, "setBackgroundResource", c.getResources().getIdentifier((red ? "pw_tab_red" : "pw_tab") + (on ? "_on" : ""), "drawable", c.getPackageName()));
            Intent ti = new Intent(c, getClass()).setAction(ACTION_TAB).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid).putExtra("tab", g.optString("key"));
            rv.setOnClickPendingIntent(tv, PendingIntent.getBroadcast(c, (wid * 100 + 80 + i) & 0x7fffffff, ti, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        // the group's reset: a ticking clock within a day, "4d 8h" further out, or the cycle's name
        long ends = cur == null ? 0 : cur.optLong("ends", 0);
        String time = cur == null ? "" : cur.optString("time");
        boolean ticking = ends > now && ends - now < 864e5, far = ends - now >= 864e5;
        vis(rv, id(c, "b_gh"), ticking || far || (ends == 0 && !time.isEmpty()));
        vis(rv, id(c, "b_gchrono"), ticking); vis(rv, id(c, "b_gclock"), ticking || far); vis(rv, id(c, "b_gtime"), !ticking);
        if (ticking) { rv.setChronometer(id(c, "b_gchrono"), SystemClock.elapsedRealtime() + (ends - now), null, true); rv.setChronometerCountDown(id(c, "b_gchrono"), true); }
        else rv.setTextViewText(id(c, "b_gtime"), far ? left(ends - now) : time);
        rv.setTextViewText(id(c, "b_empty"), "Nothing here");
        // redraw when a clock runs out (midnight, or the tab's reset), so it never counts below zero
        try {
            long at = Math.min(nextMidnight(), ticking ? ends : Long.MAX_VALUE) + 2000;
            int[] ids = AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, getClass()));
            Intent up = new Intent(c, getClass()).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.set(AlarmManager.RTC, at, PendingIntent.getBroadcast(c, 4444, up, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        } catch (Exception ignored) {}
        return rv;
    }

    /** One row of the 4x4 list (a full quest, or two halves), drawn like the home-screen tiles. */
    RemoteViews boardRow(Context c, JSONArray row, int wid, int pos, int widthDp) throws Exception {
        RemoteViews rv = new RemoteViews(c.getPackageName(), c.getResources().getIdentifier("psych_widget_row", "layout", c.getPackageName()));
        float dens = c.getResources().getDisplayMetrics().density;
        int w = Math.max(120, widthDp - 20);
        JSONObject first = row.optJSONObject(0);
        if (first != null && first.optBoolean("isHdr")) {   // a subheader: "// WEEKLY" and when that cycle resets
            long ends = first.optLong("ends"), now = System.currentTimeMillis();
            String when = ends > now ? left(ends - now) : first.optString("time");
            vis(rv, id(c, "r0_hdr"), true); vis(rv, id(c, "r0_content"), false);
            text(rv, id(c, "r0_hdr_t"), first.optString("title"));
            text(rv, id(c, "r0_hdr_time"), when); vis(rv, id(c, "r0_hdr_time"), !when.isEmpty());
            return rv;
        }
        vis(rv, id(c, "r0_hdr"), false);
        vis(rv, id(c, "r0_content"), true);
        vis(rv, id(c, "r0f"), false); vis(rv, id(c, "r0a"), false); vis(rv, id(c, "r0b"), false);
        if (row.length() == 2) {
            tile(c, rv, "r0a", row.optJSONObject(0), wid, pos * 3 + 1, true, (w - 8) / 2, dens);
            tile(c, rv, "r0b", row.optJSONObject(1), wid, pos * 3 + 2, true, (w - 8) / 2, dens);
        } else tile(c, rv, "r0f", row.optJSONObject(0), wid, pos * 3, false, w, dens);
        return rv;
    }

    static int parse(String s, int fallback) { try { return Color.parseColor(s); } catch (Exception e) { return fallback; } }
}
