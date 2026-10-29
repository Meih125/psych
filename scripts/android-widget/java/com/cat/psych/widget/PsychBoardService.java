package com.cat.psych.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Fills the 4x4 widget's scrolling list: the rows of the tab it shows, each a full quest or two halves. */
public class PsychBoardService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1));
    }

    static class Factory implements RemoteViewsFactory {
        final Context c;
        final int wid;
        final List<JSONArray> rows = new ArrayList<>();
        int widthDp = 250;

        // draws the tiles like the other widgets, but a tap fills in the list's shared intent (WidgetTapActivity)
        final PsychWidgetProvider drawer = new PsychWidgetProvider() {
            @Override protected String size() { return "4x4"; }
            @Override void click(Context ctx, RemoteViews rv, int vid, JSONObject s, String act, int req) {
                if (vid == 0) return;
                Intent i = new Intent().putExtra("qid", s.optString("qid")).putExtra("act", act == null ? "" : act)
                    .putExtra("name", s.optString("name")).putExtra("unit", s.optString("unit")).putExtra("pre", s.optBoolean("pre"))
                    .putExtra("chunk", s.optDouble("chunk", 0)).putExtra("carry", s.optDouble("carry", 0))
                    .putExtra("xpPer", s.optInt("xpPer")).putExtra("goldPer", s.optInt("goldPer"));
                rv.setOnClickFillInIntent(vid, i);
            }
        };

        Factory(Context c, int wid) { this.c = c; this.wid = wid; }

        @Override public void onCreate() { load(); }
        @Override public void onDataSetChanged() { load(); }
        @Override public void onDestroy() { rows.clear(); }

        void load() {
            rows.clear();
            widthDp = PsychWidgetProvider.widthDp(AppWidgetManager.getInstance(c), wid);
            JSONObject w = PsychWidgetProvider.findConfig(c, wid, "4x4");
            JSONObject b = w == null ? null : w.optJSONObject("board");
            JSONObject g = b == null ? null : PsychWidgetProvider.tabOf(c, wid, b.optJSONArray("groups"));
            JSONArray rs = g == null ? null : g.optJSONArray("rows");
            if (rs != null) for (int i = 0; i < rs.length(); i++) { JSONArray r = rs.optJSONArray(i); if (r != null && r.length() > 0) rows.add(r); }
        }

        @Override public int getCount() { return rows.size(); }

        @Override
        public RemoteViews getViewAt(int pos) {
            try { if (pos < rows.size()) return drawer.boardRow(c, rows.get(pos), wid, pos, widthDp); } catch (Exception ignored) {}
            return new RemoteViews(c.getPackageName(), c.getResources().getIdentifier("psych_widget_row", "layout", c.getPackageName()));
        }

        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int pos) { return pos; }
        @Override public boolean hasStableIds() { return false; }
    }
}
