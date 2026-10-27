package com.cat.psych.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The app's side of the widgets: send the snapshot, collect taps, ask the launcher to place a widget. */
@CapacitorPlugin(name = "PsychWidget")
public class PsychWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "{}");
        Context c = getContext();
        PsychWidgetProvider.prefs(c).edit().putString("snapshot", data).apply();
        PsychWidgetProvider.refreshAll(c);
        call.resolve();
    }

    @PluginMethod
    public void takeActions(PluginCall call) {
        Context c = getContext();
        String a = PsychWidgetProvider.prefs(c).getString("actions", "[]");
        PsychWidgetProvider.prefs(c).edit().putString("actions", "[]").apply();
        JSObject r = new JSObject();
        r.put("actions", a);
        call.resolve(r);
    }

    /** Which widgets are on the home screen: their ids, or "size:4x1" for one added from the launcher's list. */
    @PluginMethod
    public void placed(PluginCall call) {
        Context c = getContext();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        StringBuilder out = new StringBuilder();
        String[] sizes = PsychWidgetProvider.SIZES;
        for (int i = 0; i < PsychWidgetProvider.PROVIDERS.length; i++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, PsychWidgetProvider.PROVIDERS[i]));
            if (ids == null) continue;
            for (int id : ids) {
                String cfg = PsychWidgetProvider.prefs(c).getString("map_" + id, null);
                if (out.length() > 0) out.append(',');
                out.append(cfg != null ? cfg : "size:" + sizes[i]);
            }
        }
        JSObject r = new JSObject();
        r.put("ids", out.toString());
        call.resolve(r);
    }

    @PluginMethod
    public void pin(PluginCall call) {
        Context c = getContext();
        String size = call.getString("size", "4x1"), id = call.getString("id", "");
        JSObject r = new JSObject();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !m.isRequestPinAppWidgetSupported()) { r.put("pinned", false); call.resolve(r); return; }
        Class<?> cls = PsychWidgetProvider.providerFor(size);
        Intent cb = new Intent(c, cls).setAction(PsychWidgetProvider.ACTION_PINNED).putExtra("configId", id);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(c, id.hashCode() & 0x7fffffff, cb, flags);
        boolean ok = m.requestPinAppWidget(new ComponentName(c, cls), null, pi);
        r.put("pinned", ok);
        call.resolve(r);
    }
}
