import type { Category } from "../checks/types.js";

export interface CategoryDef {
  id: Category;
  name: string;
  weight: number;
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "context",
    name: "Context Efficiency",
    weight: 0.35,
    description: "Minimizing tokens consumed by context window",
  },
  {
    id: "cost",
    name: "Cost Optimization",
    weight: 0.30,
    description: "Reducing per-token and per-session costs",
  },
  {
    id: "structure",
    name: "Structure",
    weight: 0.20,
    description: "Configuration organization and best practices",
  },
  {
    id: "habits",
    name: "Habits",
    weight: 0.15,
    description: "Developer workflow patterns that reduce waste",
  },
];
