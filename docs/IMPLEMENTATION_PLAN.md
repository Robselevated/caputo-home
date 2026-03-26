# Caputo Home Implementation Plan

## Objective

Implement the requested features in a controlled order that minimizes breakage, preserves maintainability, and gives each phase a clear testable outcome.

## Execution Rules

1. Work in phases
2. Finish one phase before moving to the next
3. Do not refactor unrelated areas unless required
4. Explain model changes before applying them
5. Reuse existing architecture when practical
6. Prefer reusable components and services over one off logic

## Phase 1, Architecture audit

### Goal
Understand the current codebase before changing behavior.

### Tasks
1. Identify files related to:
   1. cookbook and recipe detail
   2. recipe creation
   3. recipe scraping
   4. image upload
   5. pantry categorization
   6. inventory data access
   7. any AI or suggestion features
2. Identify current models for:
   1. recipes
   2. pantry items
   3. fridge items
   4. freezer items
3. Identify where category inference happens
4. Identify whether recipe images already exist in the model
5. Identify where the best edit flow should live
6. Identify architectural constraints and risks

### Deliverable
A concise audit report containing:

1. relevant files
2. current data structures
3. required schema or model changes
4. recommended implementation order
5. risks or unknowns

## Phase 2, Recipe edit flow

### Goal
Allow cookbook recipes to be edited after creation or scrape.

### Tasks
1. Add an Edit action to recipe detail view
2. Create recipe edit UI
3. Allow title edits
4. Allow ingredient edits
5. Allow ingredient add and remove
6. Allow instruction edits
7. Allow upload or replacement of recipe main image
8. Save changes cleanly
9. Preserve compatibility with existing recipes

### Deliverable
A working recipe edit experience with stable persistence.

## Phase 3, OCR recipe import

### Goal
Allow users to create a recipe from an uploaded recipe image while also supporting a separate finished dish image.

### Tasks
1. Add recipe source image upload to manual recipe creation
2. Add separate finished dish image upload
3. Parse recipe source image into structured fields
4. Pre fill recipe form using extracted data
5. Require user review before save
6. Save source image and finished dish image distinctly
7. Handle incomplete OCR output gracefully

### Deliverable
A manual recipe entry flow that supports OCR import and user review.

## Phase 4, Pantry Bread category

### Goal
Add Bread as a pantry category and route bread related items correctly.

### Tasks
1. Add Bread to pantry category definitions
2. Update category dropdowns or selectors
3. Update inference or matching logic
4. Update filters and views that use pantry categories
5. Validate common Bread examples

### Deliverable
Bread is available as a category and bread items no longer default to Other in common cases.

## Phase 5, AI recipe suggestions

### Goal
Generate recipe suggestions using current inventory.

### Tasks
1. Build a modular suggestion service using pantry, fridge, and freezer data
2. Create a first pass UI for recipe suggestions
3. Keep placement flexible so it can live on Cookbook or a dedicated page later
4. Support full matches where possible
5. Support near matches if practical
6. Allow a user to save useful suggestions later, if current architecture supports it cleanly

### Deliverable
A first version of AI recipe suggestions based on household inventory.

## Output Format Required After Each Phase

After each completed phase, provide:

1. files changed
2. summary of what was implemented
3. model changes made
4. manual testing steps
5. remaining limitations or follow ups