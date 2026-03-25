# Caputo App — Category & Subcategory Taxonomy

## FREEZER

| Category | Subcategories |
|---|---|
| Beef | Ribeye, NY Strip, T-Bone, Flank Steak, Sirloin, Brisket, Chuck Roast, Short Ribs, Other |
| Pork | Pork Chops, Pork Tenderloin, Pork Shoulder, Pork Ribs, Pork Loin, Other |
| Chicken | Breast, Thighs, Wings, Drumsticks, Whole Chicken, Tenders, Other |
| Turkey | Turkey Breast, Whole Turkey, Turkey Cutlets, Other |
| Ground Meat | Ground Beef, Ground Turkey, Ground Chicken, Ground Pork, Italian Sausage, Breakfast Sausage, Kielbasa, Bratwurst, Chorizo, Other |
| Fish | Salmon, Tilapia, Cod, Halibut, Mahi Mahi, Tuna, Other |
| Seafood | Shrimp (Raw), Shrimp (Cooked), Scallops, Crab, Lobster, Other |
| Frozen Produce | (flat — no subcategory) |
| Frozen Meals | (flat — no subcategory) |
| Other | (flat — no subcategory) |

Default unit for meat categories: **lbs**
Default unit for Frozen Produce, Frozen Meals, Other: **bags** (user can override)

---

## FRIDGE

| Category | Subcategories |
|---|---|
| Deli Meat | Black Forest Ham, Honey Ham, Roasted Turkey, Deli Chicken, Salami, Pepperoni, Prosciutto, Other |
| Bacon | (flat — no subcategory) |
| Lettuce | Romaine, Iceberg, Green Leaf, Kale, Spinach, Arugula, Mixed Greens, Other |
| Apples | Fuji, Gala, Granny Smith, Honeycrisp, Pink Lady, Other |
| Oranges | Navel, Blood Orange, Mandarin/Clementine, Valencia, Other |
| Pears | Bartlett, Bosc, D'Anjou, Other |
| Dairy | (flat — no subcategory) |
| Produce (Other) | (flat — no subcategory) |
| Other | (flat — no subcategory) |

Default unit for Deli Meat: **lbs**
Default unit for produce: **count**
Default unit for Dairy/Other: **count**

---

## PANTRY

| Category | Subcategories |
|---|---|
| Pasta | Spaghetti, Penne, Bow Tie (Farfalle), Elbow, Fettuccine, Linguine, Angel Hair, Rigatoni, Rotini, Lasagna, Orzo, Other |
| Canned Goods | (flat — no subcategory) |
| Dry Goods | (flat — no subcategory) |
| Sauces & Condiments | (flat — no subcategory) |
| Spices | (flat — no subcategory) |
| Snacks | (flat — no subcategory) |
| Baking | (flat — no subcategory) |
| Beverages | (flat — no subcategory) |
| Other | (flat — no subcategory) |

Default unit for Canned Goods: **cans**
Default unit for Dry Goods, Pasta: **boxes** or **bags**
Default unit for Sauces/Condiments: **bottles** or **jars**
Default unit for Spices: **jars**

---

## PHOTO SCAN BEHAVIOR (Claude Vision API)

### Pantry & Freezer Scan
1. User taps camera icon in Pantry or Freezer section
2. Takes photo (or uploads from camera roll)
3. Image sent to Netlify serverless function → Claude Vision API
4. Claude returns structured JSON array of detected items:
   ```json
   [
     {
       "name": "Black Beans",
       "category": "Canned Goods",
       "subcategory": null,
       "qty": 3,
       "unit": "cans",
       "confidence": "high",
       "needs_verification": false
     },
     {
       "name": "Unknown item",
       "category": null,
       "subcategory": null,
       "qty": 1,
       "unit": null,
       "confidence": "low",
       "needs_verification": true,
       "verification_prompt": "I can see a green can but can't read the label clearly. What is this item?"
     }
   ]
5. App shows Review Screen:
   - All high-confidence items listed with detected name, qty, category
   - Low-confidence items shown with yellow flag and a text field for user to correct/confirm
   - Items that match an existing inventory entry shown with "Will add to existing qty of X" note
   - User can edit any field before confirming
   - "Confirm All" button or per-item confirm/reject toggles
6. On confirm: items added/updated in inventory_items, scan_session saved as 'confirmed'

### Key matching rules:
- Different brands of same product = same inventory row (e.g. "Bush's Black Beans" + "Great Value Black Beans" = "Black Beans" qty +2)
- Different varieties of same broad category = separate rows (e.g. "Penne" and "Spaghetti" are separate)
- Meat cuts always separate rows (Ribeye ≠ NY Strip)

### Receipt Scan (Grocery List)
1. User taps camera icon in Grocery List section
2. Takes photo of receipt
3. Claude Vision reads all line items, filters out non-food items (taxes, fees, household goods if not relevant)
4. Returns list of food items purchased
5. Review screen: user confirms items to move to Recently Bought
6. Confirmed items added to recently_bought + item_history (for autocomplete)
