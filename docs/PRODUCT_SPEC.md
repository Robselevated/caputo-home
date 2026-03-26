# Caputo Home Product Spec

## Product Overview

Caputo Home is a household food management app that helps users manage:

1. Grocery lists
2. Pantry inventory
3. Fridge inventory
4. Freezer inventory
5. Cookbook recipes

The product should feel modern, clean, intuitive, and easy to maintain. AI features should assist the user, but users must always be able to review and correct data manually.

## Product Principles

1. User control comes first
Users must always be able to edit or correct AI generated, OCR extracted, or scraped content.

2. Structured data over raw text
Recipes, ingredients, instructions, categories, and images should be stored in structured fields wherever possible.

3. Separate source assets from display assets
A recipe source image and a finished dish image are different assets and should be treated differently in the data model and UI.

4. Categorization should be practical
Inventory categories should map to how people actually organize food in a home.

5. Build for extension
New categories, image types, edit flows, and AI tools should be easy to add later without major rewrites.

## Requested Features

### 1. Manual recipe entry with image import

Users need a manual recipe entry flow that supports two separate image uploads:

#### A. Recipe source image
This is an uploaded image of the recipe itself, such as:

1. Screenshot of a recipe
2. Cookbook page
3. Handwritten recipe card
4. Printed recipe photo

Expected behavior:

1. The app accepts the uploaded recipe image
2. The app scans and parses the image
3. The app attempts to extract:
   1. recipe title
   2. ingredients
   3. instructions
4. The app pre populates a structured recipe form using the extracted data
5. The user reviews and edits the extracted data before saving
6. The recipe is saved as a normal cookbook recipe

Important:
The image import flow must never auto save without user review.

#### B. Finished dish image
This is a separate uploaded image showing the completed recipe.

Expected behavior:

1. The user can upload a finished dish image separately from the recipe source image
2. This image should be used as the main recipe display image where applicable
3. The image should appear on recipe cards and recipe detail views when available

### 2. Editable cookbook recipes

Cookbook recipes need an edit flow.

Expected behavior:

1. When a user opens a cookbook recipe, there should be a visible Edit action
2. The edit experience should allow the user to:
   1. edit recipe title
   2. edit ingredients
   3. add ingredients
   4. remove ingredients
   5. edit instructions
   6. upload or replace the main recipe image
   7. correct scraped or OCR extracted content
3. Changes should save cleanly without breaking existing recipes

Important:
If a recipe was scraped from a website but no image was pulled, the user must be able to upload a recipe image manually through the edit flow.

### 3. Pantry Bread category

The pantry needs a Bread category.

Expected behavior:

1. Bread should exist as a first class pantry category
2. Bread related items should map to Bread instead of Other whenever possible
3. Bread should appear anywhere pantry categories are shown or selected

Examples that should typically map to Bread:

1. bread
2. bagels
3. buns
4. rolls
5. tortillas
6. naan
7. pita
8. English muffins
9. hamburger buns
10. hot dog buns

### 4. AI recipe suggestions from current inventory

The app should support AI recipe suggestions using available inventory.

Inventory sources:

1. Fridge
2. Freezer
3. Pantry

Goal:
Suggest meal or recipe ideas based on ingredients the household already has.

Placement is not finalized yet. The feature should be implemented in a modular way so it can later live in either:

1. the Cookbook page
2. a dedicated AI Recipes page in bottom navigation

Expected behavior:

1. The system reads current inventory
2. The system determines likely usable ingredients
3. The system suggests recipes that can be made fully or mostly from available items
4. The system may also identify near matches and show missing ingredients
5. The system should be built so users can later save useful suggestions to the cookbook

## Functional Requirements

### Recipe editing
1. Add Edit action to recipe detail view
2. Support updating title, ingredients, instructions, and display image
3. Support ingredient add and remove
4. Preserve existing recipe records

### OCR based recipe import
1. Support upload of recipe source image
2. Parse uploaded image into structured recipe fields
3. Pre fill a reviewable recipe form
4. Require user confirmation before save
5. Store finished dish image separately from recipe source image

### Pantry categorization
1. Add Bread category to pantry category definitions
2. Update any matching or inference logic
3. Update pantry selectors, filters, and views to support Bread

### AI recipe suggestions
1. Read inventory from pantry, fridge, and freezer
2. Generate recipe suggestions from available ingredients
3. Support flexible UI placement
4. Keep first implementation simple and extensible

## Data Model Expectations

The recipe model should support, either directly or through a related structure:

1. `title`
2. `ingredients`
3. `instructions`
4. `mainImage`
5. `sourceRecipeImage`
6. `sourceType`, such as manual, scraped, OCR, or AI suggested
7. metadata fields if needed for future extension

The pantry item model and related category logic should support:

1. a Bread category
2. future category expansion without rewriting matching logic everywhere

## UX Requirements

1. The user should always be able to override bad AI or OCR output
2. Image upload should be clear and separate by purpose
3. Editing should feel native to the recipe experience
4. Bread should be easy to find and select
5. AI suggestions should feel useful, not random or gimmicky

## Non Goals for This Phase

1. Full autonomous recipe creation without user review
2. Highly advanced ingredient normalization across every edge case
3. Perfect OCR on all image types
4. Final placement decision for AI Recipes in navigation

## Delivery Expectations

Each feature should be built in a way that:

1. does not break current functionality
2. preserves current app architecture where possible
3. favors reusable components and services
4. can be tested independently