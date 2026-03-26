# Caputo Home Claude Task Prompts

## Prompt 1, Architecture audit

I am giving you this codebase along with PRODUCT_SPEC.md and IMPLEMENTATION_PLAN.md.

Your task is to perform Phase 1 only.

Please:

1. identify all relevant files for:
   1. recipes
   2. cookbook screens
   3. recipe creation
   4. recipe scraping
   5. image upload
   6. pantry category logic
   7. inventory retrieval
   8. any suggestion or AI related services
2. identify the current recipe and inventory models
3. identify where image upload and recipe parsing should be implemented
4. identify what needs to change to support:
   1. recipe editing
   2. OCR based recipe import
   3. separate recipe source image and finished dish image
   4. Bread pantry category
   5. AI recipe suggestions from pantry, fridge, and freezer
5. recommend the cleanest implementation order
6. do not implement full features yet

Return:

1. architecture summary
2. relevant file map
3. required data or model changes
4. risks or unknowns
5. recommended next step

## Prompt 2, Recipe edit flow

Using PRODUCT_SPEC.md and IMPLEMENTATION_PLAN.md, implement Phase 2 only.

Requirements:

1. add an Edit action to the recipe detail screen
2. create a recipe edit experience
3. allow editing of:
   1. title
   2. ingredients
   3. instructions
4. allow adding and removing ingredients
5. allow uploading or replacing the main recipe image
6. preserve existing functionality and existing recipes
7. keep the implementation clean and reusable

Before coding:

1. explain which files you plan to change
2. explain any data model updates required

After coding:

1. summarize files changed
2. summarize what works
3. list manual test steps
4. list any remaining gaps

Do not implement OCR import yet.
Do not implement AI recipe suggestions yet.

## Prompt 3, OCR recipe import

Using PRODUCT_SPEC.md and IMPLEMENTATION_PLAN.md, implement Phase 3 only.

Requirements:

1. in manual recipe entry, add a recipe source image upload
2. add a separate finished dish image upload
3. parse the recipe source image and extract:
   1. recipe title
   2. ingredients
   3. instructions
4. pre populate the recipe form with extracted data
5. require the user to review and edit before saving
6. save the finished dish image as a separate display asset
7. make the flow resilient when extraction is incomplete

Before coding:

1. explain the proposed data flow
2. explain any model changes
3. explain any dependencies or integrations required

After coding:

1. summarize files changed
2. explain the end to end user flow
3. list edge cases still needing refinement
4. list manual test steps

Do not implement AI recipe suggestions yet.

## Prompt 4, Pantry Bread category

Using PRODUCT_SPEC.md and IMPLEMENTATION_PLAN.md, implement Phase 4 only.

Requirements:

1. add Bread as a pantry category
2. update any pantry category selectors
3. update matching or inference logic so common bread items map to Bread
4. ensure pantry views and filters support the category
5. keep the solution easy to extend later

Before coding:

1. identify all places where pantry categories are defined, rendered, or inferred

After coding:

1. summarize files changed
2. explain how Bread matching works
3. list sample items that should now map to Bread
4. list manual test steps

## Prompt 5, AI recipe suggestions

Using PRODUCT_SPEC.md and IMPLEMENTATION_PLAN.md, implement Phase 5 only.

Requirements:

1. build a modular recipe suggestion feature using current pantry, fridge, and freezer inventory
2. keep UI placement flexible so it can later live on Cookbook or a dedicated AI Recipes page
3. suggest recipes that can be made from available ingredients
4. if practical, also show near matches and missing ingredients
5. keep the first implementation simple and extensible

Before coding:

1. explain whether you recommend starting on Cookbook or a dedicated page
2. explain the proposed architecture and data flow

After coding:

1. summarize files changed
2. explain how suggestions are generated
3. list current limitations
4. list manual test steps