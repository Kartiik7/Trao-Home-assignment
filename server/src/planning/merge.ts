import type { Kit, Question, Flashcard, CompanyBrief } from "@ai-interview-prep/types";

export interface RegenerateScope {
  type: "company_brief" | "questions" | "flashcards";
  category?: "technical" | "behavioural" | "system-design" | "company-fit";
}

/**
 * Pure function to merge regenerated items into an existing kit,
 * strictly preserving any items that are "pinned".
 */
export function mergeRegeneratedSection(
  existingKit: Kit,
  regeneratedItems: Partial<Kit>,
  scope: RegenerateScope
): Kit {
  // Deep clone to ensure purity
  const newKit: Kit = JSON.parse(JSON.stringify(existingKit));

  if (scope.type === "company_brief" && regeneratedItems.company_brief) {
    if (!newKit.company_brief._meta?.pinned) {
      newKit.company_brief = regeneratedItems.company_brief;
    }
    return newKit;
  }

  if (scope.type === "questions" && regeneratedItems.questions) {
    // Separate questions into:
    // 1. Pinned in the target scope (these survive)
    // 2. Out of scope entirely (these survive)
    // 3. Unpinned in the target scope (these are discarded)
    const survivingExisting: Question[] = [];

    newKit.questions.forEach((q) => {
      const inScope = !scope.category || q.category === scope.category;
      if (!inScope || q._meta?.pinned) {
        survivingExisting.push(q);
      }
    });

    // We only want the newly regenerated items that belong to the scope.
    // (In practice, regeneratedItems.questions should only contain the newly generated ones anyway).
    const newItems = regeneratedItems.questions.filter((q) => {
      return !scope.category || q.category === scope.category;
    });

    // Merge: surviving first, new appended.
    newKit.questions = [...survivingExisting, ...newItems];

    // Maintain stable order: grouped by category ideally, but appending is fine
    // since the UI supports drag-and-drop anyway.
    return newKit;
  }

  if (scope.type === "flashcards" && regeneratedItems.flashcards) {
    const survivingExisting: Flashcard[] = [];
    newKit.flashcards.forEach((f) => {
      if (f._meta?.pinned) {
        survivingExisting.push(f);
      }
    });

    newKit.flashcards = [...survivingExisting, ...regeneratedItems.flashcards];
    return newKit;
  }

  return newKit;
}
