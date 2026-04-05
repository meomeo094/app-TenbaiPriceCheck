const express = require("express");
const { getSupabase } = require("../lib/supabase");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase chưa cấu hình: kiểm tra SUPABASE_URL và SUPABASE_ANON_KEY trong .env",
      });
    }

    const { product_url, target_price, interval_min, notification_channel } = req.body ?? {};

    const url = typeof product_url === "string" ? product_url.trim() : "";
    if (!url) {
      return res.status(400).json({ error: "Thiếu hoặc không hợp lệ: product_url" });
    }

    const price =
      typeof target_price === "number"
        ? target_price
        : typeof target_price === "string" && target_price.trim() !== ""
          ? Number(target_price)
          : NaN;
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Thiếu hoặc không hợp lệ: target_price (số ≥ 0)" });
    }

    const interval =
      typeof interval_min === "number"
        ? interval_min
        : typeof interval_min === "string" && interval_min.trim() !== ""
          ? parseInt(interval_min, 10)
          : NaN;
    if (!Number.isInteger(interval) || interval < 1) {
      return res.status(400).json({ error: "Thiếu hoặc không hợp lệ: interval_min (số nguyên ≥ 1)" });
    }

    const channel =
      typeof notification_channel === "string" && notification_channel.trim() !== ""
        ? notification_channel.trim()
        : "push";

    const row = {
      product_url: url,
      target_price: price,
      interval_min: interval,
      notification_channel: channel,
    };

    const { data, error } = await supabase.from("price_monitors").insert(row).select().single();

    if (error) {
      console.error("[monitor] Lỗi insert price_monitors:", error.message, error);
      return res.status(500).json({
        error: "Không lưu được monitor",
        details: error.message,
        code: error.code ?? undefined,
      });
    }

    return res.status(201).json({ monitor: data });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase chưa cấu hình: kiểm tra SUPABASE_URL và SUPABASE_ANON_KEY trong .env",
      });
    }

    const { data, error } = await supabase.from("price_monitors").select("*").order("id", { ascending: true });

    if (error) {
      console.error("[monitor] Lỗi select price_monitors:", error.message, error);
      return res.status(500).json({
        error: "Không tải được danh sách monitor",
        details: error.message,
        code: error.code ?? undefined,
      });
    }

    return res.json({ monitors: data ?? [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
