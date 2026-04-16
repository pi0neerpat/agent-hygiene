import type { CheckRunResult } from "../checks/index.js";
import type { Category } from "../checks/types.js";
import { CATEGORIES, type CategoryDef } from "./categories.js";

export interface CategoryScore {
  category: CategoryDef;
  score: number; // 0-100
  grade: string; // A+ to F
  passed: number;
  total: number;
  checks: CheckRunResult[];
}

export interface OverallScore {
  score: number; // 0-100
  grade: string;
  categories: CategoryScore[];
}

/**
 * Calculate the overall hygiene score from check results.
 *
 * Formula: Σ(check.weight × passed) / Σ(check.weight) × 100
 * Category scores are weighted: Context 35%, Cost 30%, Structure 20%, Habits 15%
 */
export function calculateScore(results: CheckRunResult[]): OverallScore {
  const categories: CategoryScore[] = CATEGORIES.map((cat) => {
    const catChecks = results.filter(
      (r) => r.check.category === cat.id,
    );

    if (catChecks.length === 0) {
      return {
        category: cat,
        score: 100, // No checks = no issues
        grade: "A+",
        passed: 0,
        total: 0,
        checks: [],
      };
    }

    const totalWeight = catChecks.reduce(
      (sum, r) => sum + r.check.weight,
      0,
    );
    const passedWeight = catChecks.reduce((sum, r) => {
      if (r.result.passed) return sum + r.check.weight;
      // Session/semi-auto checks with low confidence get partial credit
      if (
        (r.check.tier === "session" || r.check.tier === "semi-auto") &&
        r.result.confidence !== undefined
      ) {
        return sum + r.check.weight * r.result.confidence;
      }
      // Advisory checks that are acknowledged get partial credit
      if (r.check.tier === "advisory") {
        return sum + r.check.weight * 0.3;
      }
      return sum;
    }, 0);

    const score = Math.round((passedWeight / totalWeight) * 100);
    const passed = catChecks.filter((r) => r.result.passed).length;

    return {
      category: cat,
      score,
      grade: scoreToGrade(score),
      passed,
      total: catChecks.length,
      checks: catChecks,
    };
  });

  // Weighted overall score
  const overall = Math.round(
    categories.reduce(
      (sum, cat) => sum + cat.score * cat.category.weight,
      0,
    ),
  );

  return {
    score: overall,
    grade: scoreToGrade(overall),
    categories,
  };
}

function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}
