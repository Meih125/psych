package com.cat.psych.widget;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** A small box over the home screen to type an amount for a Tally (or a value for a Record) from a widget. */
public class WidgetInputActivity extends Activity {
    int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

    TextView button(String text, String color) {
        TextView b = new TextView(this);
        b.setText(text); b.setTextColor(Color.parseColor(color)); b.setTextSize(13); b.setGravity(Gravity.CENTER);
        b.setTypeface(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD);
        b.setPadding(dp(14), dp(10), dp(14), dp(10));
        GradientDrawable g = new GradientDrawable(); g.setStroke(dp(1.5f), Color.parseColor(color)); g.setCornerRadius(dp(3)); b.setBackground(g);
        return b;
    }

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        final String qid = getIntent().getStringExtra("qid"), act = getIntent().getStringExtra("act");
        String name = getIntent().getStringExtra("name"), unit = getIntent().getStringExtra("unit");
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable bg = new GradientDrawable(); bg.setColor(Color.parseColor("#F2071012")); bg.setStroke(dp(1), Color.parseColor("#4D2EE6D6")); bg.setCornerRadius(dp(6));
        box.setBackground(bg);
        TextView t = new TextView(this);
        t.setText(name == null ? "" : name); t.setTextColor(Color.parseColor("#F2F7F6")); t.setTextSize(15);
        t.setTypeface(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD);
        box.addView(t);
        final EditText in = new EditText(this);
        in.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        in.setHint("record".equals(act) ? "Value" + (unit == null || unit.isEmpty() ? "" : " (" + unit + ")") : "Amount" + (unit == null || unit.isEmpty() ? "" : " (" + unit + ")"));
        in.setTextSize(22);
        in.setTextColor(Color.parseColor("#F2F7F6")); in.setHintTextColor(Color.parseColor("#5F7472")); in.setTypeface(android.graphics.Typeface.MONOSPACE);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(10);
        box.addView(in, lp);
        // Tally: show what the amount will pay as you type (rewards come in steps; the leftover carries over)
        final double chunk = getIntent().getDoubleExtra("chunk", 0), carry = getIntent().getDoubleExtra("carry", 0);
        final int xpPer = getIntent().getIntExtra("xpPer", 0), goldPer = getIntent().getIntExtra("goldPer", 0);
        final TextView pay = new TextView(this);
        pay.setTextColor(Color.parseColor("#2EE6D6")); pay.setTextSize(15);
        pay.setTypeface(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pp.topMargin = dp(8);
        if ("tally".equals(act) && chunk > 0) {
            box.addView(pay, pp);
            pay.setText(reward(0, 0, pay));
            in.addTextChangedListener(new android.text.TextWatcher() {
                public void beforeTextChanged(CharSequence a, int b, int c, int d) {}
                public void onTextChanged(CharSequence a, int b, int c, int d) {}
                public void afterTextChanged(android.text.Editable e) {
                    double v; try { v = Double.parseDouble(e.toString().replace(',', '.').trim()); } catch (Exception x) { v = 0; }
                    int units = v > 0 ? (int) Math.floor((carry + v) / chunk + 1e-9) : 0;
                    pay.setText(reward(units * xpPer, units * goldPer, pay));
                }
            });
        }
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL); row.setGravity(Gravity.END);
        TextView cancel = button("CANCEL", "#9DB2B0"), ok = button("record".equals(act) ? "RECORD" : "ADD", "#FF8A45");
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bp.leftMargin = dp(8);
        row.addView(cancel, bp); row.addView(ok, bp);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rp.topMargin = dp(12);
        box.addView(row, rp);
        setContentView(box);
        getWindow().setLayout(Math.round(getResources().getDisplayMetrics().widthPixels * 0.86f), WindowManager.LayoutParams.WRAP_CONTENT);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        in.requestFocus();
        cancel.setOnClickListener(v -> finish());
        ok.setOnClickListener(v -> {
            double val;
            try { val = Double.parseDouble(in.getText().toString().replace(',', '.').trim()); } catch (Exception e) { val = 0; }
            if (!(val > 0) || val > 1e7) { in.setError("Enter a number above 0"); return; }
            PsychWidgetProvider.handleTap(this, qid, act, val);
            PsychWidgetProvider.refreshAll(this);
            finish();
        });
    }

    // "Reward: [gem] +N   [coin] +N" with the same gem/coin icons the widget uses
    CharSequence reward(int xp, int gold, TextView tv) {
        android.text.SpannableStringBuilder sb = new android.text.SpannableStringBuilder("Reward:  ");
        icon(sb, "pw_gem", tv);
        sb.append(" +" + xp + "    ");
        int g0 = sb.length();
        icon(sb, "pw_coin", tv);
        sb.append(" +" + gold);
        sb.setSpan(new android.text.style.ForegroundColorSpan(Color.parseColor("#FFC94A")), g0, sb.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return sb;
    }
    void icon(android.text.SpannableStringBuilder sb, String name, TextView tv) {
        int res = getResources().getIdentifier(name, "drawable", getPackageName());
        if (res == 0) return;
        android.graphics.drawable.Drawable d = getResources().getDrawable(res, getTheme());
        int sz = (int) (tv.getTextSize() * 1.15f);
        d.setBounds(0, 0, sz, sz);
        int at = sb.length();
        sb.append("\u00A0");
        sb.setSpan(new android.text.style.ImageSpan(d, android.text.style.ImageSpan.ALIGN_BOTTOM), at, at + 1, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    }
}
