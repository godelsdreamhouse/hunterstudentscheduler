import type { EnrollmentCombination, PrototypeCourse, PrototypeDay, PrototypeSection } from "./courseFirstPrototype";

function section(
  sourceSectionId: string,
  classNumber: string,
  sectionNumber: string,
  component: PrototypeSection["component"],
  instructor: string,
  days: PrototypeDay[],
  startTime: string,
  endTime: string,
  location: string,
): PrototypeSection {
  return { sourceSectionId, classNumber, sectionNumber, component, instructor, meetings: [{ days, startTime, endTime, location }] };
}

function combination(courseId: string, courseCode: string, courseTitle: string, associationIdentity: string, sections: PrototypeSection[]): EnrollmentCombination {
  return {
    id: `${courseId}-${associationIdentity}`,
    courseId,
    courseCode,
    courseTitle,
    term: "Spring 2027 (synthetic)",
    session: "Regular Academic Session",
    associationIdentity,
    sourceRecordIds: sections.map((item) => `synthetic-source:${item.sourceSectionId}`),
    sections,
  };
}

export const PROTOTYPE_COURSES: PrototypeCourse[] = [
  {
    id: "csci-127",
    code: "CSCI 127",
    title: "Introduction to Computer Science",
    description: "Synthetic lecture and lab associations for prototype evaluation.",
    combinations: [
      combination("csci-127", "CSCI 127", "Introduction to Computer Science", "assoc-csci-a", [
        section("csci-127-lec-01", "11001", "01", "lecture", "A. Example", ["Monday", "Wednesday"], "09:00", "10:15", "North 100"),
        section("csci-127-lab-1a", "11011", "1A", "lab", "B. Example", ["Friday"], "09:00", "10:50", "North 100"),
      ]),
      combination("csci-127", "CSCI 127", "Introduction to Computer Science", "assoc-csci-b", [
        section("csci-127-lec-02", "11002", "02", "lecture", "C. Example", ["Tuesday", "Thursday"], "11:00", "12:15", "North 100"),
        section("csci-127-lab-2a", "11012", "2A", "lab", "D. Example", ["Saturday"], "10:00", "11:50", "North 100"),
      ]),
      combination("csci-127", "CSCI 127", "Introduction to Computer Science", "assoc-csci-c", [
        section("csci-127-lec-03", "11003", "03", "lecture", "E. Example", ["Monday", "Wednesday"], "13:00", "14:15", "North 100"),
        section("csci-127-lab-3a", "11013", "3A", "lab", "F. Example", ["Sunday"], "12:00", "13:50", "North 100"),
      ]),
    ],
  },
  {
    id: "biol-100",
    code: "BIOL 100",
    title: "Principles of Biology",
    description: "Synthetic lecture, lab, and discussion associations.",
    combinations: [
      combination("biol-100", "BIOL 100", "Principles of Biology", "assoc-biol-a", [
        section("biol-100-lec-01", "12001", "01", "lecture", "G. Example", ["Tuesday", "Thursday"], "09:00", "10:15", "North 200"),
        section("biol-100-lab-1a", "12011", "1A", "lab", "H. Example", ["Wednesday"], "15:00", "17:40", "North 201"),
        section("biol-100-dis-1d", "12021", "1D", "discussion", "I. Example", ["Friday"], "11:00", "11:50", "North 202"),
      ]),
      combination("biol-100", "BIOL 100", "Principles of Biology", "assoc-biol-b", [
        section("biol-100-lec-02", "12002", "02", "lecture", "J. Example", ["Monday", "Wednesday"], "10:30", "11:45", "North 200"),
        section("biol-100-lab-2a", "12012", "2A", "lab", "K. Example", ["Thursday"], "14:00", "16:40", "North 201"),
        section("biol-100-dis-2d", "12022", "2D", "discussion", "L. Example", ["Friday"], "12:00", "12:50", "North 202"),
      ]),
    ],
  },
  {
    id: "math-150",
    code: "MATH 150",
    title: "Calculus with Analytic Geometry I",
    description: "Synthetic lecture and recitation associations.",
    combinations: [
      combination("math-150", "MATH 150", "Calculus with Analytic Geometry I", "assoc-math-a", [
        section("math-150-lec-01", "13001", "01", "lecture", "M. Example", ["Monday", "Wednesday"], "09:30", "10:45", "North 300"),
        section("math-150-rec-1r", "13011", "1R", "recitation", "N. Example", ["Friday"], "09:00", "09:50", "North 301"),
      ]),
      combination("math-150", "MATH 150", "Calculus with Analytic Geometry I", "assoc-math-b", [
        section("math-150-lec-02", "13002", "02", "lecture", "O. Example", ["Tuesday", "Thursday"], "13:00", "14:15", "North 300"),
        section("math-150-rec-2r", "13012", "2R", "recitation", "P. Example", ["Friday"], "10:00", "10:50", "North 301"),
      ]),
    ],
  },
  {
    id: "artla-201",
    code: "ARTLA 201",
    title: "Weekend Studio Seminar",
    description: "Synthetic Sunday course used to exercise seven-day calendar support.",
    combinations: [
      combination("artla-201", "ARTLA 201", "Weekend Studio Seminar", "assoc-artla-a", [
        section("artla-201-studio-01", "14001", "01", "lecture", "Q. Example", ["Sunday"], "12:30", "15:30", "Thomas Hunter 400"),
      ]),
    ],
  },
];
