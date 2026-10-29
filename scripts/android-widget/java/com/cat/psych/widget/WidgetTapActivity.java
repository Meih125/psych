package com.cat.psych.widget;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * A tap on the 4x4 widget's list. A list can only send one kind of intent, so every tap comes here (invisible, closes at once):
 * open the app, ask for an amount (Tally / Record), or queue the action and redraw the widgets, like the other widgets' taps.
 */
public class WidgetTapActivity extends Activity {
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Intent in = getIntent();
        String qid = in.getStringExtra("qid"), act = in.getStringExtra("act");
        try {
            if (act == null || act.isEmpty() || "open".equals(act)) {
                Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (i != null) { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP); startActivity(i); }
            } else if ("tally".equals(act) || "record".equals(act)) {
                Intent i = new Intent(this, WidgetInputActivity.class);
                if (in.getExtras() != null) i.putExtras(in.getExtras());
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(i);
            } else {
                PsychWidgetProvider.handleTap(this, qid, act, null);
                PsychWidgetProvider.refreshAll(this);
            }
        } catch (Exception ignored) {}
        finish();
        overridePendingTransition(0, 0);
    }
}
