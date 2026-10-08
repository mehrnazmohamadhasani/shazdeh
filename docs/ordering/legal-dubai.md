# Direct ordering in Dubai — legal & operational checklist

_Researched 2026-10-07 from official sources where reachable. **This is not legal advice.** Items marked **UNVERIFIED** could not be confirmed from an official source — confirm with the named authority, a UAE lawyer, or a tax agent before launch._

Sources: Dubai Municipality guideline DM-FSD-GU63 v2 (issued 31/08/2023, published 16/02/2024); RTA delivery-services technical manual (Sep 2023) and RTA news (Dec 2022); Dubai Media Office (Oct 2025); Ministry of Economy & Tourism legislation list; u.ae PDPL page (updated 04/12/2025); Stripe and Telr merchant pages. DET, WAM, uaelegislation.gov.ae and tax.gov.ae blocked automated fetching; where a law-firm summary or news report was used instead, it is cited as such.

---

## A. What the restaurant legally needs

### 1. Trade licence
- **There is no separate "food ordering website licence"** — none was found in any official source.
- A valid UAE licence is a precondition for online selling: Federal Decree-Law 14/2023 (trading by modern technology) requires digital merchants to be appropriately licensed ([Hadef, Apr 2026](https://hadefpartners.com/news-insights/insights/digital-platform-compliance-key-considerations-for-uae-platforms/)); Consumer Protection Law 15/2020 Art. 25 requires UAE e-commerce providers to disclose their licensing authority ([Bracewell](https://www.bracewell.com/wp-content/uploads/2025/04/UAE-Consumer-Protection-Law.pdf); [Tamimi](https://tamimi.com/law-update-articles/the-new-consumer-protection-law-in-the-uae)).
- In practice a restaurant / delivery-kitchen food activity covers selling its own meals however they are ordered. Delivery-only kitchens are typically licensed as "restaurant without dine-in" or "food preparation and delivery" (consultant source). Activity codes such as 5610-01 / 5610.05 are **UNVERIFIED** — check DET's [activity search](https://app.invest.dubai.ae/search-business-activities).
- **Whether an e-commerce / "Online Seller" activity (reportedly code 6312009) must be added is UNVERIFIED — get written confirmation from DET.** The eTrader licence targets individuals/home businesses and is not the right route.
- Mainland DET licence → may sell to consumers across Dubai. Free-zone licence → generally needs zone permission to sell to mainland consumers (**UNVERIFIED**).

### 2. Dubai Municipality food safety (every delivery model)
DM-FSD-GU63 v2 ([page](https://www.dm.gov.ae/documents/requirements-for-food-transportation-and-delivery-vehicles/), [PDF](https://dmpmedia.dm.gov.ae/uploads/2024/02/2.-DM-FSD-GU63-Requirements-for-food-transportation-and-delivery-vehicles-guidelines-update.pdf)) explicitly covers vehicles delivering food ordered online:
- Licence activity must permit transporting/delivering food (§1.2a).
- Temperatures: cold ≤5 °C, hot ≥60 °C, frozen ≤−18 °C, dry ≤30 °C (§1.4.1c).
- **Max 30 minutes in transit** unless extra temperature control is used (§1.4.1d). → _Zone ETAs and radii should be set with this in mind._
- Sealed containers; hot and cold separated; damaged packages not delivered; **anti-tamper stickers** (§1.4.1e–g).
- Clean/disinfect boxes with DM-approved agents; no non-food items in the food compartment.
- Bike boxes: food-grade, light-coloured, insulated; heating/cooling if trip > 1 h; must meet RTA specs too (§1.4.2).
- **FoodWatch:** establishment registered; every delivery vehicle (incl. bikes) registered under it; drivers registered as food handlers; delivery rejections logged and investigated by the PIC (§1.5).
- If a third party delivers, the restaurant must ensure it meets these requirements (§1.4.1j).
- Annual digital permit for food transport vehicles via DM-approved testing centres (§2). Whether a delivery motorbike needs it or only FoodWatch registration is **UNVERIFIED**.
- At least one certified Person in Charge (PIC).

### 3. Allergens
The Dubai Food Code requires declaring major allergens, reportedly available **before** an online purchase is completed ([Khaleej Times](https://www.khaleejtimes.com/nation/general/dubai-issues-food-code)). Exact list/wording **UNVERIFIED**. → _The ordering UI shows ingredients/allergens on every dish sheet and an allergy notice at checkout; the owner must fill allergens for every dish._

---

## B. What the website technically needs

### Consumer protection — Law 15/2020 & Cabinet Decision 66/2023 (in force 14 Oct 2023)
- Arabic disclosure of name, legal status, address, licensing authority, specs, contract, payment and warranty terms (Art. 25).
- Website information, terms and invoices **in Arabic** (English may be added) — _reported_ ([Tamimi](https://tamimi.com/law-update-articles/the-new-consumer-protection-law-in-the-uae)). **Plan Arabic versions of terms, policies and the receipt.**
- Dated invoice with trade name, address, item, price, quantity (Reg. Art. 6).
- Show prices at point of sale; state if cards are accepted; **no card surcharges** (Reg. Art. 5). → _The system never surcharges online/card payments._
- Avoid banned one-sided clauses (Reg. Art. 34); avoid "no refunds under any circumstances".
- State the policy for wrong / missing / damaged / late orders and refund timing.

### E-commerce — Federal Decree-Law 14/2023 (penalties: Cabinet Resolution 200/2025, from 28 Nov 2025)
Before checkout show terms, stages of the sale, specs, timeframes, delivery and other fees (Art. 6(1)); issue detailed invoices (Art. 5(8)); payment fees must match declared terms; don't obstruct returns; provide a complaints mechanism (Art. 6(6)–(8)); secure environment; make trade licence and contact details public. Penalties up to AED 100,000 plus closure for repeats. ([Hadef](https://hadefpartners.com/news-insights/insights/digital-commerce-platform-compliance-the-new-penalty-framework-for-uae-platforms/))

### VAT
- Consumer prices must be displayed **VAT-inclusive** (Cabinet Decision 52/2017) — default in this system.
- 5% on food; restaurant-charged delivery fee likely standard-rated as part of the supply (**confirm with tax agent**).
- Simplified tax invoice: "Tax Invoice", supplier name, address, **TRN**, date, description, VAT-inclusive total, VAT amount ([u.ae guidance](https://u.ae/-/media/Information-and-services/Finance-and-Investment/VAt-guidelines/rights-as-a-consumer-Tax-invoice-eng.pdf)). → _Legal name/TRN fields exist in Ordering settings and print on the receipt._
- National e-invoicing mandate (2026 phased) covers B2B/B2G, not B2C.

### Data protection — PDPL, Federal Decree-Law 45/2021
In force since 2 Jan 2022 ([u.ae](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws)); executive regulations' status **UNVERIFIED**. Contract performance covers name/phone/address; marketing needs **separate opt-in** (unticked checkbox — implemented); retention limits; security; breach reporting. Check the Telemarketing Regulation (Cabinet Resolution 56/2024) before WhatsApp/phone marketing.

---

## C. What the delivery operation needs

**Own riders** — RTA "Technical Manual: Managing delivery services through electronic platforms" ([PDF](https://rta.ae/links/licensing/delivery-services-manual-en.pdf)): RTA establishment permit; riders with UAE licence, good-conduct certificate, sponsored visa, age 21–55, uniform, RTA training/permit ([RTA](https://rta.ae/wps/portal/rta/ae/home/news-and-media/all-news/NewsDetails/rta-rolls-out-programme-for-certifying-delivery-motorbike-riders)), safety gear, no backpacks; bikes GCC-spec, ≤4 years, 100–200 cc, Dubai-registered, insured, RTA-tested; box ≤50×50×50 cm with reflective tape and company name; RTA advertising permit for branding; lane restrictions since 1 Nov 2025 ([Dubai Media Office](https://www.mediaoffice.ae/en/news/2025/october/19-10/rta-and-dubai-police-regulate-delivery-bike-use-on-high-speed-lanes-across-dubai)). Plus all DM rules (FoodWatch registration of bikes and riders). Whether a single restaurant delivering only its own orders needs the full establishment permit is **UNVERIFIED — ask RTA**.

**Third-party logistics** — the 3PL must be RTA-licensed; the restaurant remains responsible for its food-safety compliance (DM §1.4.1j). Contract should cover RTA permit, DM-compliant boxes, FoodWatch-registered riders, temperature/30-minute rules, anti-tamper handover, data-processing terms, liability/insurance. **Lowest-burden route to launch.**

**Hybrid** — each part follows its own rules.

---

## D. What the payment provider needs
- CBUAE licensing applies to the gateway, not the merchant (**UNVERIFIED citation**).
- Typical onboarding: UAE trade licence, MOA (LLC), IDs of 25%+ owners/managers, UAE bank letter/statement < 6 months ([Stripe](https://support.stripe.com/questions/uae-business-verification-requirements); [Network International](https://www.network.ae/en/contact-us/det-network)).
- Website review ([Telr checklist](https://telr.com/website-checklist)): content matches licence; prices & currency; card logos; About; T&Cs stating UAE domicile & governing law, no OFAC-sanctioned countries, no users under 18; privacy & cookie policy; delivery policy (areas, fees, times); refund policy (to original card); cancellation policy; full contact details.
- MCC 5812/5814 (convention). Hosted checkout keeps PCI DSS at SAQ A — **this system uses hosted checkout only.**
- No card surcharge. Cash on delivery: no specific rule found beyond invoices/price display (**UNVERIFIED**); define rider cash-handling controls.

## E. Optional
.ae domain (open; .co.ae needs licence/trademark); Media Council permits apply to paid influencers, not own accounts; halal labelling not required for an ordinary menu without pork/alcohol (**UNVERIFIED**); allergen matrix, calorie info (**UNVERIFIED** if mandatory), SMS tracking, complaint log, ratings.

## F. Questions to confirm before launch
1. **DET** — does the current activity cover website ordering + delivery? Add "Online Seller" or delivery activity?
2. **DM Food Safety** — motorbike permit vs FoodWatch only; allergen list and online-disclosure wording; any approval for direct selling.
3. **RTA** — permit needed for a restaurant delivering only its own orders? Fees?
4. **MOHRE** — rider visa route.
5. **Lawyer** — PDPL executive regulations; Arabic obligations; compliant refund/cancellation clause for perishable food.
6. **Tax agent** — VAT on delivery fee, invoice wording, TRN display.
7. **Gateway** — MCC, pre-launch website review, settlement timing.
8. **Free zone** (if applicable) — permission to sell to mainland.
