export type LinkItem = { label: string; href: string };

export interface Skill {
  name: string;
  level: number;
  family: string;
  note?: string;
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  start: string;
  end: string | null;
  location: string;
  type: string;
  summary: string;
  bullets: string[];
  stack: string[];
}

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  year: number;
  role: string;
  status: string;
  cover: string;
  coverBg: string;
  stack: string[];
  context: string;
  problem: string;
  solution: string;
  outcome: string;
  metrics: { label: string; value: string }[];
}

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  tag: string;
  body: string[];
}
