/**
 * @file JdbcCoursesRepositoryTests.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;


import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import edu.hunter.watchtower.common.Course;

@SpringBootTest
public class JdbcCoursesRepositoryTests {

    @Autowired
    private JdbcCoursesRepository jdbcCoursesRepository;

    @Test
    void contextLoads() {

    }

    @Test
    void testFindByCourseCode() {
        String courseCode = "CSCI 499";
        ArrayList<Course> course = jdbcCoursesRepository.findByCourseCode(courseCode);
        
        assertTrue(course.size() == 1);
        Course c = course.get(0);
        assertTrue(
            c.courseID.equals("49900") &&
            c.departmentCode.equals("CSCI") &&
            c.name.equals("Advanced Applications: A Capstone for Majors") &&
            c.credit == 4.0f
        );

        ArrayList<Course> courses = jdbcCoursesRepository.findByCourseCode("CSCI 26");
        assertTrue(courses.size() == 3);
        assertTrue(
            courses.get(0).courseID.equals("26000") &&
            courses.get(0).departmentCode.equals("CSCI") &&
            courses.get(0).name.equals("Computer Architecture 2") &&
            courses.get(0).credit == 3.0f &&
            courses.get(1).courseID.equals("26500") &&
            courses.get(1).departmentCode.equals("CSCI") &&
            courses.get(1).name.equals("Computer Theory 1") &&
            courses.get(1).credit == 3.0f &&
            courses.get(2).courseID.equals("26700") &&
            courses.get(2).departmentCode.equals("CSCI") &&
            courses.get(2).name.equals("Micro Processing & Embedded System") &&
            courses.get(2).credit == 3.0f
        );
    }


}
