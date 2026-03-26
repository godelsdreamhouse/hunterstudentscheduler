#test data for structure

from models import * #imports all classes from models.py


def test():
  
  calc_two = Course(CourseId("MATH", 15500), 3, "calculus 2", ["Mathematical and Quantitative Reasoning"], [], [] )
  expos_wri = Course(CourseId("ENGL", 120), 3, "Expository Writing", ["English Composition"], [], [])
  intro_wri_abt_lit = Course(CourseId("ENGL", 220), 3, "Intro:Writing about Literature", ["English Composition"], [expos_wri], [])
  micahs_majors = StudentProgram(["MATH", "CSCI"], ["PHILO"])

  micah = StudentProfile( 23942520, micahs_majors, [calc_two, expos_wri], ["no class on fridays"])




  ß