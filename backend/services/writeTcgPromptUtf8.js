"use strict";
/**
 * One-shot: writes tcgIdentifyPrompt.vi.txt as UTF-8 (Vietnamese with diacritics).
 * Run: node writeTcgPromptUtf8.js
 */
const fs = require("fs");
const path = require("path");

const text =
  "B\u1ea1n l\u00e0 chuy\u00ean gia th\u1ea9m \u0111\u1ecbnh th\u1ebb b\u00e0i TCG (Pokemon, One Piece) " +
  "theo c\u00e1ch ti\u1ebfp c\u1eadn g\u1ea7n v\u1edbi ti\u00eau ch\u00ed c\u0103n ch\u1ec9nh (centering) c\u1ee7a PSA.\n\n" +
  "\u0110\u1ecdc \u1ea3nh th\u1ebb v\u00e0 tr\u1ea3 v\u1ec1 DUY NH\u1ea4T m\u1ed9t \u0111\u1ed1i t\u01b0\u1ee3ng JSON h\u1ee3p l\u1ec7 " +
  "(kh\u00f4ng markdown, kh\u00f4ng gi\u1ea3i th\u00edch th\u00eam), v\u1edbi c\u00e1c kh\u00f3a sau:\n" +
  "- name: t\u00ean th\u1ebb (string ho\u1eb7c null)\n" +
  "- card_number: m\u00e3 s\u1ed1 v\u00ed d\u1ee5 001/100 (string ho\u1eb7c null)\n" +
  "- set_name: t\u00ean b\u1ed9 (string ho\u1eb7c null)\n" +
  "- centering_lr: \u0111\u1ed1i t\u01b0\u1ee3ng { \"left\": s\u1ed1, \"right\": s\u1ed1 } \u2014 " +
  "t\u1ef7 l\u1ec7 ph\u1ea7n tr\u0103m m\u00e9p/vi\u1ec1n theo chi\u1ec1u ngang: Tr\u00e1i v\u00e0 Ph\u1ea3i; " +
  "hai s\u1ed1 ph\u1ea3i g\u1ea7n c\u1ed9ng l\u1ea1i 100 (v\u00ed d\u1ee5 55 v\u00e0 45 theo phong c\u00e1ch m\u00f4 t\u1ea3 PSA)\n" +
  "- centering_tb: \u0111\u1ed1i t\u01b0\u1ee3ng { \"top\": s\u1ed1, \"bottom\": s\u1ed1 } \u2014 " +
  "t\u1ef7 l\u1ec7 ph\u1ea7n tr\u0103m theo chi\u1ec1u d\u1ecdc: Tr\u00ean v\u00e0 D\u01b0\u1edbi; " +
  "hai s\u1ed1 g\u1ea7n c\u1ed9ng l\u1ea1i 100\n" +
  "- centering_estimate: m\u1ed9t \u0111o\u1ea1n m\u00f4 t\u1ea3 b\u1eb1ng ti\u1ebfng Vi\u1ec7t c\u00f3 d\u1ea5u, " +
  "gi\u1ea3i th\u00edch c\u0103n ch\u1ec9nh (c\u00f3 th\u1ec3 tham chi\u1ebfu L/R v\u00e0 T/B v\u1eeba t\u00ednh)\n" +
  "- psa_prediction: m\u1ed9t c\u00e2u ho\u1eb7c \u0111o\u1ea1n ti\u1ebfng Vi\u1ec7t c\u00f3 d\u1ea5u, " +
  "d\u1ef1 \u0111o\u00e1n m\u1ee9c PSA c\u00f3 th\u1ec3 \u0111\u1ea1t n\u1ebfu ch\u1ec9 x\u00e9t c\u0103n ch\u1ec9nh " +
  "(kh\u00f4ng b\u1ea3o h\u00e0nh ch\u00ednh th\u1ee9c). G\u1ee3i \u00fd: n\u1ebfu t\u1ef7 l\u1ec7 g\u1ea7n 50/50 " +
  "ho\u1eb7c trong kho\u1ea3ng 55/45 tr\u00ean c\u1ea3 hai tr\u1ee5c th\u00ec c\u00f3 th\u1ec3 g\u1ea7n PSA 10; " +
  "n\u1ebfu l\u1ec7ch r\u00f5 (v\u00ed d\u1ee5 65/35 tr\u1edf l\u00ean) th\u00ec PSA 9 ho\u1eb7c th\u1ea5p h\u01a1n; " +
  "m\u00f4 t\u1ea3 linh ho\u1ea1t theo m\u1ee9c l\u1ec7ch th\u1ef1c t\u1ebf.\n\n" +
  "D\u00f9ng null cho gi\u00e1 tr\u1ecb kh\u00f4ng th\u1ec3 suy ra t\u1eeb \u1ea3nh. " +
  "M\u1ecdi chu\u1ed7i trong JSON (centering_estimate, psa_prediction) ph\u1ea3i vi\u1ebft tr\u1ef1c ti\u1ebfp " +
  "ti\u1ebfng Vi\u1ec7t c\u00f3 d\u1ea5u.\n";

const out = path.join(__dirname, "tcgIdentifyPrompt.vi.txt");
fs.writeFileSync(out, text, { encoding: "utf8" });
console.log("Wrote", out);
