import {
  BarChart3,
  BookOpen,
  ChartNoAxesCombined,
  GraduationCap,
  House,
  Library,
  UsersRound,
} from "lucide-react";

export const navigation = [
  { label: "Home", href: "/home", icon: House },
  { label: "Subjects", href: "/subjects", icon: BookOpen },
  { label: "Exams", href: "/exams", icon: GraduationCap },
  { label: "Statistics", href: "/statistics", icon: BarChart3 },
  { label: "Library", href: "/library", icon: Library },
  { label: "Classes", href: "/classes", icon: UsersRound },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
];

export const mobileNavigation = [
  navigation[0],
  navigation[1],
  navigation[3],
  navigation[5],
];
