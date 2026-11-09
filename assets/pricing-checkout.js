/* Pricing checkout config for /pricing/.
   One constant: future Stripe Payment Link URLs, plus the 30% deposit in US dollars.
   Leave each url empty until online booking is turned on.
   This file does not load Stripe.js, does not read keys, and does not turn a url into a live link.
   Buttons and the agreement checkbox stay disabled either way.
   Deposits are 30% of the published starting prices, verified against the pages and Offer schema:
     Growth Audit $3,500 → 1050
     Strategy Workshop $2,500 → 750
     Advisory Retainer $3,000 (first month) → 900
     Fractional CMO $8,000 (first month) → 2400
*/
const PRICING_CHECKOUT = {
  growthAudit: { url: "", deposit: 1050 },
  strategyWorkshop: { url: "", deposit: 750 },
  advisoryRetainer: { url: "", deposit: 900, firstMonth: true },
  fractionalCmo: { url: "", deposit: 2400, firstMonth: true }
};

(function () {
  function money(n) {
    return "$" + Number(n).toLocaleString("en-US");
  }
  Object.keys(PRICING_CHECKOUT).forEach(function (key) {
    var item = PRICING_CHECKOUT[key];
    var label = "30% deposit " + money(item.deposit) + (item.firstMonth ? ", first month" : "");
    document.querySelectorAll('[data-deposit="' + key + '"]').forEach(function (el) {
      el.textContent = label;
    });
    document.querySelectorAll('[data-checkout="' + key + '"]').forEach(function (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.removeAttribute("href");
    });
  });
  document.querySelectorAll(".agree input").forEach(function (box) {
    box.disabled = true;
    box.checked = false;
  });
})();
