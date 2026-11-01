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
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

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
    public static final String ACTION_PAGE = "com.cat.psych.widget.PAGE";

    protected abstract String size();

    public static final Class<?>[] PROVIDERS = { Widget2x1.class, Widget4x1.class, Widget2x2.class, Widget4x2.class, Widget4x4.class };
    public static final String[] SIZES = { "2x1", "4x1", "2x2", "4x2", "4x4" };

    boolean isBoard() { return "4x4".equals(size()); }
    /** A List shows as many lines as fit: the whole list on the 4x4, otherwise what the widget's current height allows (drag it taller for more). */
    int lineCap = 8;
    /** drawing a 4x4 row (no streaks there) */
    boolean boardMode = false;

    public static Class<?> providerFor(String size) {
        for (int i = 0; i < SIZES.length; i++) if (SIZES[i].equals(size)) return PROVIDERS[i];
        return Widget4x1.class;
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Redraw every Psych widget on the home screen (the app sent new data: lists are rebuilt). */
    public static void refreshAll(Context c) { refreshAll(c, false); }

    /** soft = after a tap on a widget or a background step sync: the 4x4's list is refreshed in place,
     *  so it keeps its scroll position (a full redraw rebuilt the list and jumped back to the top of the tab). */
    public static void refreshAll(Context c, boolean soft) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> cls : PROVIDERS) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, cls));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(c, cls).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids).putExtra("soft", soft);
            c.sendBroadcast(i);
        }
    }

    void redraw(Context c, AppWidgetManager m, int id) { redraw(c, m, id, false); }

    void redraw(Context c, AppWidgetManager m, int id, boolean soft) {
        try {
            if (isBoard()) m.updateAppWidget(id, buildBoard(c, m, id));
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
        for (int id : ids) { e.remove("map_" + id); e.remove("tab_" + id); e.remove("page_" + id); }
        e.apply();
    }

    @Override
    public void onReceive(Context c, Intent in) {
        String a = in.getAction();
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(a) && in.getBooleanExtra("soft", false)) {
            int[] ids = in.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            if (ids != null) for (int id : ids) redraw(c, m, id, true);
            return;
        }
        if (ACTION_PINNED.equals(a)) {
            int id = in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            String cfg = in.getStringExtra("configId");
            if (id != -1 && cfg != null) prefs(c).edit().putString("map_" + id, cfg).apply();
            refreshAll(c);
            return;
        }
        if (ACTION_PAGE.equals(a)) {   // 4x4: turn the page (the page count is worked out when it is drawn, so a stale tap stays in range)
            int id = in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1), d = in.getIntExtra("d", 0);
            if (id != -1) { prefs(c).edit().putInt("page_" + id, Math.max(0, prefs(c).getInt("page_" + id, 0) + d)).apply(); redraw(c, AppWidgetManager.getInstance(c), id); }
            return;
        }
        if (ACTION_TAB.equals(a)) {   // 4x4: show another group
            int id = in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            String key = in.getStringExtra("tab");
            if (id != -1 && key != null) { prefs(c).edit().putString("tab_" + id, key).putInt("page_" + id, 0).apply(); redraw(c, AppWidgetManager.getInstance(c), id); }
            return;
        }
        if (ACTION_TAP.equals(a)) {
            handleTap(c, in.getStringExtra("qid"), in.getStringExtra("act"), null);
            refreshAll(c, true);
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
                        if (addXp == 0 && addGold == 0) {   // what this tap pays, once (the same quest can sit on several widgets)
                            if (("claim".equals(act) || "steps".equals(act)) && !s.optBoolean("done")) { addXp = s.optLong("rawXp"); addGold = s.optLong("rawGold"); }
                            else if ("pair:bonus".equals(act)) {   // the bonus: its rewards ride along in bonusItem
                                JSONObject bi = s.optJSONObject("bonusItem");
                                if (bi != null && !s.optBoolean("done") && s.optInt("cdone") >= s.optInt("ctot")) { addXp = bi.optLong("rawXp"); addGold = bi.optLong("rawGold"); }
                            }
                            else if (act.startsWith("pair")) {
                                for (String k : new String[] { "items", "short" }) {
                                    JSONArray ia = s.optJSONArray(k);
                                    for (int x = 0; ia != null && x < ia.length(); x++) {
                                        JSONObject h = ia.optJSONObject(x);
                                        if (h != null && act.equals(h.optString("act")) && !h.optBoolean("done")) { addXp = h.optLong("rawXp"); addGold = h.optLong("rawGold"); }
                                    }
                                }
                            }
                        }
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

    /** Bordered button styles: text colour (the border is drawable pw_btn_<style>). gold = Tally's ADD, rec = Record,
     *  pair / scal / ctr / bty / avd = List, Recurring, Counter, Bounty, Avoid (keep in step with KIND_COL in app.js). */
    static final Map<String, Integer> BTN_COL = new HashMap<>();
    static {
        BTN_COL.put("or", 0xFFFF8A45); BTN_COL.put("ok", 0xFF3FD47A); BTN_COL.put("red", 0xFFFF8A7F); BTN_COL.put("cy", 0xFF2EE6D6);
        BTN_COL.put("dim", 0xFF6F8482); BTN_COL.put("gold", 0xFFFFC94A); BTN_COL.put("rec", 0xFFA98BFF); BTN_COL.put("pair", 0xFF5CABFF);
        BTN_COL.put("scal", 0xFFFF7A7A); BTN_COL.put("ctr", 0xFF4DD0A0); BTN_COL.put("bty", 0xFFB6E85A); BTN_COL.put("avd", 0xFFFF8FB1);
    }
    /** The button style for a quest type's colour (the "k" buttons). */
    static String kindStyle(String hex) {
        switch (hex) {
            case "#5cabff": return "pair";  case "#ff7a7a": return "scal"; case "#4dd0a0": return "ctr";
            case "#a98bff": return "rec";   case "#ffc94a": return "gold"; case "#2ee6d6": return "cy";
            case "#b6e85a": return "bty";   case "#ff8fb1": return "avd";  default: return "or";
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
            if ("counter".equals(kind)) {   // no done state: the count goes up, the tile stays tappable
                String st = s.optString("streak", "0"); int c = 0;
                try { c = Integer.parseInt(st.replaceAll("[^0-9]", "")); } catch (Exception e) { }
                s.put("streak", (c + 1) + "\u00D7");
                return;
            }
            if ("avoid".equals(kind)) b.put(btn("SLIP", "slip", "red"));
            b.put(btn("DONE", "", "done"));
            s.put("btn", b).put("done", true).put("tap", "open").put("doneUntil", nextMidnight());
        } else if ("hit".equals(act)) {
            int n = s.optInt("need", s.optInt("needN", 1)), h = Math.min(n, s.optInt("hits") + 1);
            s.put("hits", h).put("tap", h >= n ? "claim" : "hit");
            if (s.has("needN")) s.put("pct", h * 100 / n).put("sub", h + " / " + n);
            b.put(h >= n ? btn("CLAIM", "claim", "k").put("color", s.optString("color")) : btn(h + "/" + n, "hit", "k").put("color", s.optString("color")));
            s.put("btn", b);
        } else if ("hits".equals(act) && value != null) {   // a big target (more than 10): an amount of hits
            int n = s.optInt("need", s.optInt("needN", 1)), h = Math.min(n, s.optInt("hits") + (int) Math.floor(value));
            s.put("hits", h).put("tap", h >= n ? "claim" : "hits").put("sub", h + " / " + n);
            if (s.has("needN")) s.put("pct", h * 100 / n);
            b.put(h >= n ? btn("CLAIM", "claim", "k").put("color", s.optString("color")) : btn("+ ADD", "hits", "k").put("color", s.optString("color")));
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
            b.put(btn("DONE", "", "done"));
            s.put("btn", b).put("done", true).put("tap", "open").put("sub", num(value) + " " + s.optString("unit") + " recorded");
        } else if ("steps".equals(act)) {
            s.put("btn", b).put("done", true).put("tap", "open").put("note", "claimed");
        } else if (act.startsWith("pair")) {
            if ("pair:bonus".equals(act)) {   // the list's bonus was claimed: the whole tile fades
                b.put(btn("DONE", "", "done"));
                s.put("btn", b).put("done", true).put("tap", "open").put("note", "bonus earned").put("bonusItem", JSONObject.NULL);
                return;
            }
            // a list line was tapped: it is done and the count goes up; with the last one ticked the Bonus appears right away (tap it, or the tile, to claim)
            boolean hit = false;
            for (String k : new String[] { "items", "short" }) {
                JSONArray ia = s.optJSONArray(k);
                for (int x = 0; ia != null && x < ia.length(); x++) {
                    JSONObject h = ia.optJSONObject(x);
                    if (h != null && act.equals(h.optString("act")) && !h.optBoolean("done")) { h.put("done", true); hit = true; }
                }
            }
            if (hit) {
                int d = s.optInt("cdone") + 1, tot = s.optInt("ctot");
                s.put("cdone", d);
                if (tot > 0 && d >= tot && s.optBoolean("nob")) { b.put(btn("DONE", "", "done")); s.put("done", true); }
                else {
                    JSONObject bi = s.optJSONObject("bonusItem");
                    boolean ready = tot > 0 && d >= tot && bi != null;
                    b.put(ready ? btn(d + "/" + tot, "pair:bonus", "k").put("color", s.optString("color")) : btn(d + "/" + tot, "", "dim"));   // ready: the count is the bonus button
                    if (ready) s.put("note", "bonus ready").put("tap", "pair:bonus");   // no Bonus line: the count button and the tile claim it
                }
                s.put("btn", b);
            }
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
        if ("tally".equals(act) || "record".equals(act) || "hits".equals(act)) {
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
        int heightDp = 110 * rows.length();
        try { Bundle o = m.getAppWidgetOptions(appWidgetId); int mw = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0); if (mw > 0) widthDp = mw;
            int mh = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0); if (mh > 0) heightDp = mh; } catch (Exception ignored) {}
        lineCap = Math.max(2, Math.min(8, (int) ((heightDp / (float) rows.length() - 46) / 20)));   // a line is about 20dp, the title row about 46
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
        rv.setTextViewText(id(c, p + "_title"), titleText(s.optString("name"), done));
        String strk = boardMode ? "" : s.optString("streak"), mlt = boardMode ? "" : s.optString("mult");   // the 4x4 doesn't show streaks
        text(rv, id(c, p + "_streak"), strk);
        vis(rv, id(c, p + "_streak"), !strk.isEmpty());
        rv.setTextColor(id(c, p + "_streak"), strk.startsWith("0") ? 0xFF8AA09E : 0xFFE6EFED);   // the number stays quiet, only the +% carries the tier colour
        text(rv, id(c, p + "_mult"), mlt);
        vis(rv, id(c, p + "_mult"), !mlt.isEmpty());
        rv.setTextColor(id(c, p + "_mult"), parse(s.optString("streakColor"), Color.parseColor("#F5C542")));   // the +% in its streak's colour
        text(rv, id(c, p + "_xp"), s.optString("xp"));
        text(rv, id(c, p + "_gold"), s.optString("gold"));
        // line under the name (steps), the steps bar, the note after the rewards (totals, best, bonus)
        String sub = s.optString("sub"), note = s.optString("note");
        text(rv, id(c, p + "_sub"), sub);
        vis(rv, id(c, p + "_sub"), !sub.isEmpty());
        if (p.equals("r0f")) {
            // Tally on the 4x4: the rewards and "per $100" sit at the right of the total line, so the footer line goes
            boolean tl = boardMode && "tally".equals(s.optString("tap")) && !sub.isEmpty();
            vis(rv, id(c, "r0f_subrow"), !sub.isEmpty());
            vis(rv, id(c, "r0f_rew2"), tl);
            vis(rv, id(c, "r0f_ft"), !tl);
            if (tl) { text(rv, id(c, "r0f_xp2"), s.optString("xp")); text(rv, id(c, "r0f_gold2"), s.optString("gold")); text(rv, id(c, "r0f_note2"), note); }
        }
        // on the 4x4 a tile is only as tall as its lines: the stretchy gaps (made for the fixed-size widgets) would be blown up by the launcher
        if (boardMode) { vis(rv, id(c, p + "_fa"), false); vis(rv, id(c, p + "_fb"), false); }
        int bar = id(c, p + "_bar");
        if (s.has("pct")) { rv.setProgressBar(bar, 100, Math.max(0, Math.min(100, s.optInt("pct"))), false); vis(rv, bar, true); } else vis(rv, bar, false);
        if (p.endsWith("f")) {
            // a full tile with a bar (Target, Steps): "50 / 120" sits at the right end of the bar, no line of its own; a finished one fades
            boolean inBar = s.has("pct") && !sub.isEmpty();
            vis(rv, id(c, p + "_barrow"), s.has("pct"));
            vis(rv, id(c, p + "_bartxt"), inBar);
            if (inBar) { text(rv, id(c, p + "_bartxt"), sub); vis(rv, id(c, p + "_sub"), false); vis(rv, id(c, p + "_subrow"), false); }
            if (done && boardMode) { rv.setFloat(id(c, p + "_barrow"), "setAlpha", 0.4f); rv.setFloat(id(c, p + "_subrow"), "setAlpha", 0.4f); }
        }
        int nt = id(c, p + "_note");
        text(rv, nt, note);
        // "Next pays +160%": the % in the quest's own colour
        java.util.regex.Matcher pm = java.util.regex.Pattern.compile("\\+\\d+%").matcher(note);
        if (nt != 0 && pm.find()) {
            SpannableStringBuilder nb = new SpannableStringBuilder(note);
            nb.setSpan(new ForegroundColorSpan(color), pm.start(), pm.end(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            rv.setTextViewText(nt, nb);
        }
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
        // list: its items as lines, each tappable, as many as fit the tile's height (all of them on the 4x4)
        int pair = id(c, p + "_pair");
        JSONArray its = s.optJSONArray(s.has("items") ? "items" : "short");
        if (pair != 0 && its != null && its.length() > 0) {
            vis(rv, pair, true);
            int dotCol = parse(s.optString("color"), 0xFF5CABFF);
            for (int k = 0; k < 8; k++) {
                String q = p + "_pl" + k;
                int row = id(c, q);
                JSONObject h = k < its.length() && k < lineCap ? its.optJSONObject(k) : null;
                if (h == null) { vis(rv, row, false); continue; }
                vis(rv, row, true);
                boolean hd = h.optBoolean("done");
                SpannableStringBuilder sb = new SpannableStringBuilder((hd ? "\u25CF  " : "\u25CB  ") + h.optString("label"));
                sb.setSpan(new ForegroundColorSpan(dotCol), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                sb.setSpan(new ForegroundColorSpan(hd ? 0xFF6F8583 : 0xFFF2F7F6), 3, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                if (hd) sb.setSpan(new StrikethroughSpan(), 3, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);   // a very light line, the text is already dimmed
                rv.setTextViewText(id(c, q + "_t"), sb);
                rv.setTextViewText(id(c, q + "_x"), h.optString("xp"));
                rv.setTextViewText(id(c, q + "_g"), h.optString("gold"));
                rv.setTextColor(id(c, q + "_x"), hd ? 0x808FD9CF : 0xFF8FD9CF);
                rv.setTextColor(id(c, q + "_g"), hd ? 0x80FFC94A : 0xFFFFC94A);
                click(c, rv, row, s, hd ? "open" : h.optString("act", "open"), 500000 + (wid * 1000 + slot * 20 + k) % 400000);
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
        vis(rv, id(c, p + "_rew"), !(half && nb >= 2) && !s.optBoolean("norew"));
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
            String act = b.optString("act");
            rv.setViewVisibility(vid, View.VISIBLE);
            buttonLook(rv, vid, b);
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

    // ---------- the 4x4: pages, not a scrolling list (a list jumps back to the top on some launchers whenever its rows reload) ----------
    /** A full-size quest with nothing extra to show is drawn as one slim line. */
    static boolean slimOk(JSONObject s) {
        if (s == null || s.optBoolean("half") || s.optBoolean("isHdr") || "scaling".equals(s.optString("kind"))) return false;
        if (s.has("need") || s.has("needN") || s.has("segs") || s.has("pct") || s.has("items")) return false;
        if (!s.optString("sub").isEmpty()) return false;
        JSONArray b = s.optJSONArray("btn");
        return b != null && b.length() == 1;
    }

    /** About how tall a row is (dp), to share the rows out over pages. A little generous: a cut-off row is worse than a bit of spare room. */
    /** What a half tile has beyond the basics (dp), so a neighbour can match its footer: dots, a sub line / time left, a bar, a second title line. */
    static int halfExtra(JSONObject s, int tileDp) {
        if (s == null) return 0;
        int e = 0;
        if (s.has("need")) e += 25;
        if (!s.optString("sub").isEmpty() || !s.optString("due").isEmpty()) e += 15;
        if (s.has("pct")) e += 14;
        int avail = Math.max(40, tileDp - 58);
        if (s.optString("name").length() * 7.6f > avail) e += 16;
        return e;
    }

    static int rowHeight(JSONArray row) {
        JSONObject f = first(row);
        if (f == null) return 0;
        if (f.optBoolean("isHdr")) return 27;
        if (row.length() == 2) {
            int h = 0;
            for (int i = 0; i < 2; i++) { JSONObject s = row.optJSONObject(i); if (s == null) continue;
                int e = 68; if (s.has("need")) e += 18; if (!s.optString("sub").isEmpty() || !s.optString("due").isEmpty()) e += 18; if (s.has("pct")) e += 11; h = Math.max(h, e); }
            return h + 5;
        }
        if (f.optBoolean("bcard")) return 90;
        if (slimOk(f)) return 48 + (!f.optString("due").isEmpty() && !f.optBoolean("done") ? 19 : 0);
        JSONArray its = f.optJSONArray("items");
        if (its != null) return 77 + 28 * its.length() + 5;
        if ("tally".equals(f.optString("tap")) && !f.optString("sub").isEmpty()) return 75;
        int h = 65;
        if (!f.optString("sub").isEmpty()) h += 18;
        if (f.has("pct")) h += f.has("needN") ? 20 : 38;
        if (f.has("segs")) h += 14;
        return h + 5;
    }

    /** Split a tab's rows into pages that fit availDp. A subheader never ends a page (it moves on with its first row). */
    static List<List<JSONArray>> paginate(JSONArray rows, int availDp) {
        List<List<JSONArray>> pages = new ArrayList<>();
        List<JSONArray> cur = new ArrayList<>();
        int used = 0, real = 0;
        JSONArray hdrRow = null;
        for (int i = 0; rows != null && i < rows.length(); i++) {
            JSONArray r = rows.optJSONArray(i);
            if (r == null || first(r) == null) continue;
            int h = rowHeight(r);
            boolean hdr = first(r).optBoolean("isHdr");
            if (hdr && i + 1 < rows.length() && rows.optJSONArray(i + 1) != null) h += rowHeight(rows.optJSONArray(i + 1));   // keep it with the row under it
            if (real > 0 && used + h > availDp) {
                pages.add(cur); cur = new ArrayList<>(); used = 0; real = 0;
                if (!hdr && hdrRow != null) { cur.add(hdrRow); used += rowHeight(hdrRow); }   // a new page says which cycle it's in
            }
            if (hdr) hdrRow = r; else real++;
            cur.add(r); used += rowHeight(r);
        }
        if (!cur.isEmpty() || pages.isEmpty()) pages.add(cur);
        return pages;
    }

    /** The label under the tabs: DUE SOON (red), RESETS IN + clock (Daily), OTHERS; Cycles has its own subheaders instead. */
    static String groupLabel(String key) {
        switch (key) { case "due": return "// DUE SOON"; case "daily": return "// RESETS IN"; case "others": return "// OTHERS"; default: return ""; }
    }

    RemoteViews buildBoard(Context c, AppWidgetManager m, int wid) {
        RemoteViews rv = new RemoteViews(c.getPackageName(), c.getResources().getIdentifier("psych_widget_board", "layout", c.getPackageName()));
        int body = id(c, "b_body");
        rv.setOnClickPendingIntent(id(c, "b_top"), openApp(c));
        rv.setOnClickPendingIntent(id(c, "b_sum"), openApp(c));
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
            boolean on = cur != null && g.optString("key").equals(cur.optString("key"));
            rv.setViewVisibility(tv, View.VISIBLE);
            rv.setTextViewText(tv, g.optString("tab"));
            boolean red = g.optBoolean("red");   // DUE: something is due soon
            rv.setTextColor(tv, Color.parseColor(red ? (on ? "#FF8A7F" : "#FF6B5E") : on ? "#2EE6D6" : "#8FA6A3"));
            rv.setInt(tv, "setBackgroundResource", c.getResources().getIdentifier((red ? "pw_tab_red" : "pw_tab") + (on ? "_on" : ""), "drawable", c.getPackageName()));
            Intent ti = new Intent(c, getClass()).setAction(ACTION_TAB).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid).putExtra("tab", g.optString("key"));
            rv.setOnClickPendingIntent(tv, PendingIntent.getBroadcast(c, (wid * 100 + 80 + i) & 0x7fffffff, ti, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        // the label under the tabs: DUE SOON (red) / RESETS IN + the time left in whole minutes (Daily) / OTHERS; nothing for Cycles
        String key = cur == null ? "" : cur.optString("key"), label = groupLabel(key);
        long ends = cur == null ? 0 : cur.optLong("ends", 0);
        boolean showTime = "daily".equals(key) && ends > now;
        vis(rv, id(c, "b_gh"), !label.isEmpty());
        rv.setTextViewText(id(c, "b_gl"), label);
        rv.setTextColor(id(c, "b_gl"), Color.parseColor("due".equals(key) ? "#FF6B5E" : "#8FA6A3"));
        vis(rv, id(c, "b_gtime"), showTime);
        if (showTime) rv.setTextViewText(id(c, "b_gtime"), left(ends - now));
        // the rows of this tab, as many pages as it takes
        int widthDp = widthDp(m, wid), heightDp = 460;
        try { Bundle o = m.getAppWidgetOptions(wid); int mh = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0); if (mh > 0) heightDp = mh; } catch (Exception ignored) {}
        int avail = heightDp - 232 + (label.isEmpty() ? 24 : 0);   // header, summary, tabs, label, pager and padding take the rest
        List<List<JSONArray>> pages = paginate(cur == null ? null : cur.optJSONArray("rows"), Math.max(90, avail + 40));   // one page needs no pager, so it gets that room too
        if (pages.size() > 1) pages = paginate(cur.optJSONArray("rows"), Math.max(90, avail));
        SharedPreferences sp = prefs(c);
        int pg = Math.max(0, Math.min(pages.size() - 1, sp.getInt("page_" + wid, 0)));
        if (pg != sp.getInt("page_" + wid, 0)) sp.edit().putInt("page_" + wid, pg).apply();
        rv.removeAllViews(body);
        List<JSONArray> page = pages.get(pg);
        vis(rv, id(c, "b_empty"), page.isEmpty());
        rv.setTextViewText(id(c, "b_empty"), "Nothing here");
        lineCap = 8;
        for (int i = 0; i < page.size(); i++) {
            try { rv.addView(body, boardRow(c, page.get(i), wid, i, widthDp)); } catch (Exception ignored) {}
        }
        // the page turner
        boolean multi = pages.size() > 1;
        vis(rv, id(c, "b_pager"), multi);
        if (multi) {
            android.text.SpannableStringBuilder dots = new android.text.SpannableStringBuilder();
            for (int i = 0; i < pages.size() && i < 9; i++) {
                int at = dots.length();
                dots.append(i == 0 ? "●" : " ●");
                dots.setSpan(new ForegroundColorSpan(i == pg ? 0xFF2EE6D6 : 0xFF2A4546), at, dots.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            rv.setTextViewText(id(c, "b_dots"), dots);
            rv.setOnClickPendingIntent(id(c, "b_prev"), pageIntent(c, wid, -1));
            rv.setOnClickPendingIntent(id(c, "b_next"), pageIntent(c, wid, pg + 1 < pages.size() ? 1 : -pg));   // after the last page, back to the first
        }
        // redraw now and then so the clock stays right (every 10 min), and when a clock runs out (midnight, or the tab's reset)
        try {
            long at = Math.min(Math.min(nextMidnight() + 2000, now + 600000), ends > now ? ends + 2000 : Long.MAX_VALUE);
            int[] ids = AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, getClass()));
            Intent up = new Intent(c, getClass()).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.set(AlarmManager.RTC, at, PendingIntent.getBroadcast(c, 4444, up, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        } catch (Exception ignored) {}
        return rv;
    }

    PendingIntent pageIntent(Context c, int wid, int d) {
        Intent i = new Intent(c, getClass()).setAction(ACTION_PAGE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid).putExtra("d", d);
        return PendingIntent.getBroadcast(c, (wid * 100 + 70 + (d < 0 ? 0 : 1)) & 0x7fffffff, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** A button as a plain coloured word, no border: the quest type's colour for CLAIM and counts, a faded green DONE. */
    static void buttonLook(RemoteViews rv, int vid, JSONObject b) {
        String st = b.optString("style", "or"), act = b.optString("act");
        int col;
        if ("done".equals(st) || "dot_ok".equals(st)) col = 0x8C3FD47A;
        else {
            if ("k".equals(st) || st.startsWith("dot")) st = "dot_red".equals(st) ? "red" : "dot_dim".equals(st) || act.isEmpty() ? "dim" : kindStyle(b.optString("color", "").toLowerCase(Locale.US));
            if (!BTN_COL.containsKey(st)) st = "or";
            col = BTN_COL.get(st);
        }
        rv.setTextViewText(vid, b.optString("label"));
        rv.setTextColor(vid, col);
        rv.setInt(vid, "setBackgroundResource", 0);
    }

    /** A quest's name; a finished one gets a faint line through it, like on the Quests page. */
    static CharSequence titleText(String name, boolean done) {
        SpannableStringBuilder sb = new SpannableStringBuilder(name);
        if (done && sb.length() > 0) sb.setSpan(new StrikethroughSpan(), 0, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return sb;
    }

    /** A full-size quest as one slim line (icon, name, streak, rewards, button); a bounty's time left is a line above it. */
    /** DUE SOON: the Quests page's red bounty card (warning sign, clock + time left, rewards, CLAIM). */
    RemoteViews dueRow(Context c, JSONObject s, int wid, int slot, float dens) throws Exception {
        RemoteViews rv = new RemoteViews(c.getPackageName(), c.getResources().getIdentifier("psych_widget_due", "layout", c.getPackageName()));
        JSONArray buttons = s.optJSONArray("btn");
        boolean done = s.optBoolean("done");
        int color = parse(s.optString("color"), Color.parseColor("#FF8A45"));
        int icon = c.getResources().getIdentifier("pw_k_" + s.optString("kind", "standard"), "drawable", c.getPackageName());
        if (icon == 0) icon = c.getResources().getIdentifier("pw_k_standard", "drawable", c.getPackageName());
        int ic = id(c, "d0_ic");
        rv.setImageViewResource(ic, icon);
        rv.setInt(ic, "setColorFilter", color);
        rv.setInt(ic, "setBackgroundColor", (color & 0x00FFFFFF) | 0x26000000);
        rv.setTextViewText(id(c, "d0_title"), titleText(s.optString("name"), done));
        rv.setTextViewText(id(c, "d0_date"), s.optString("dueOn") + " \u00B7");
        rv.setTextViewText(id(c, "d0_left"), s.optString("due"));
        vis(rv, id(c, "d0_left"), !done && !s.optString("due").isEmpty());
        vis(rv, id(c, "d0_warn"), !done && s.optBoolean("warn"));
        text(rv, id(c, "d0_xp"), s.optString("xp"));
        text(rv, id(c, "d0_gold"), s.optString("gold"));
        JSONObject b = buttons != null && buttons.length() > 0 ? buttons.optJSONObject(buttons.length() - 1) : null;
        int bv = id(c, "d0_b");
        if (b == null) vis(rv, bv, false);
        else { vis(rv, bv, true); buttonLook(rv, bv, b); click(c, rv, bv, s, b.optString("act"), (wid * 100 + slot * 4 + 1) & 0x7fffffff); }
        click(c, rv, id(c, "d0_card"), s, done ? "open" : s.optString("tap", "claim"), (wid * 100 + slot * 4) & 0x7fffffff);
        click(c, rv, ic, s, "open", 0);
        return rv;
    }

    RemoteViews slimRow(Context c, JSONObject s, int wid, int slot, float dens) throws Exception {
        RemoteViews rv = new RemoteViews(c.getPackageName(), c.getResources().getIdentifier("psych_widget_slim", "layout", c.getPackageName()));
        long until = s.optLong("doneUntil", 0);
        JSONObject reset = s.optJSONObject("reset");
        JSONArray buttons = s.optJSONArray("btn");
        boolean done = s.optBoolean("done");
        String tap = s.optString("tap", "claim");
        if (until > 0 && System.currentTimeMillis() >= until && reset != null) { buttons = reset.optJSONArray("btn"); done = false; tap = reset.optString("tap", "claim"); }
        int color = parse(s.optString("color"), Color.parseColor("#FF8A45"));
        int icon = c.getResources().getIdentifier("pw_k_" + s.optString("kind", "standard"), "drawable", c.getPackageName());
        if (icon == 0) icon = c.getResources().getIdentifier("pw_k_standard", "drawable", c.getPackageName());
        int ic = id(c, "s0_ic");
        rv.setImageViewResource(ic, icon);
        rv.setInt(ic, "setColorFilter", color);
        rv.setInt(ic, "setBackgroundColor", (color & 0x00FFFFFF) | 0x26000000);
        rv.setInt(ic, "setImageAlpha", done ? 128 : 255);
        rv.setTextViewText(id(c, "s0_title"), titleText(s.optString("name"), done));
        rv.setTextColor(id(c, "s0_title"), done ? 0x80F2F7F6 : 0xFFF2F7F6);
        vis(rv, id(c, "s0_streak"), false);   // the 4x4 doesn't show streaks
        text(rv, id(c, "s0_xp"), s.optString("xp"));
        text(rv, id(c, "s0_gold"), s.optString("gold"));
        boolean norew = s.optBoolean("norew");
        for (String v : new String[] { "s0_gi", "s0_xp", "s0_ci", "s0_gold" }) vis(rv, id(c, v), !norew);
        String due = s.optString("due");
        boolean urgent = s.optBoolean("urgent") && !done;
        rv.setInt(id(c, "s0_card"), "setBackgroundResource", c.getResources().getIdentifier(urgent ? "pw_card_red" : "pw_card", "drawable", c.getPackageName()));
        int dv = id(c, "s0_due");
        if (!due.isEmpty() && !done) {
            rv.setTextViewText(dv, due);
            rv.setTextColor(dv, urgent ? 0xFFFF6B5E : 0xFFFF8A45);
            rv.setTextViewCompoundDrawables(dv, c.getResources().getIdentifier(urgent ? "pw_clock_red" : "pw_clock", "drawable", c.getPackageName()), 0, 0, 0);
            vis(rv, dv, true);
        } else vis(rv, dv, false);
        JSONObject b = buttons != null && buttons.length() > 0 ? buttons.optJSONObject(buttons.length() - 1) : null;
        int bv = id(c, "s0_b");
        if (b == null) vis(rv, bv, false);
        else { vis(rv, bv, true); buttonLook(rv, bv, b); click(c, rv, bv, s, b.optString("act"), (wid * 100 + slot * 4 + 1) & 0x7fffffff); }
        click(c, rv, id(c, "s0_card"), s, done ? "open" : tap, (wid * 100 + slot * 4) & 0x7fffffff);
        click(c, rv, ic, s, "open", 0);
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
        if (row.length() == 1 && first.optBoolean("bcard")) return dueRow(c, first, wid, pos * 3, dens);
        if (row.length() == 1 && slimOk(first)) return slimRow(c, first, wid, pos * 3, dens);
        boardMode = true;
        lineCap = 8;   // the board shows every line
        vis(rv, id(c, "r0_hdr"), false);
        vis(rv, id(c, "r0_content"), true);
        vis(rv, id(c, "r0f"), false); vis(rv, id(c, "r0a"), false); vis(rv, id(c, "r0b"), false);
        if (row.length() == 2) {
            tile(c, rv, "r0a", row.optJSONObject(0), wid, pos * 3 + 1, true, (w - 8) / 2, dens);
            tile(c, rv, "r0b", row.optJSONObject(1), wid, pos * 3 + 2, true, (w - 8) / 2, dens);
            // the footers (rewards, button) line up: the shorter tile's footer moves down by what the other one has extra
            int ea = halfExtra(row.optJSONObject(0), (w - 8) / 2), eb = halfExtra(row.optJSONObject(1), (w - 8) / 2), em = Math.max(ea, eb);
            rv.setViewPadding(id(c, "r0a_ft"), 0, Math.round((em - ea) * dens), 0, 0);
            rv.setViewPadding(id(c, "r0b_ft"), 0, Math.round((em - eb) * dens), 0, 0);
        } else tile(c, rv, "r0f", row.optJSONObject(0), wid, pos * 3, false, w, dens);
        boardMode = false;
        return rv;
    }

    static int parse(String s, int fallback) { try { return Color.parseColor(s); } catch (Exception e) { return fallback; } }
}
