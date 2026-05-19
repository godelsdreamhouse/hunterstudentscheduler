/**
 * @file JdbcCoursesRepositoryTests.java
 * @author Allison Gorman
 */
package edu.hunter.watchtower.PDFParser;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

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
        System.out.println("Searching for courses with code: " + courseCode);
        var courses = jdbcCoursesRepository.findByCourseCode(courseCode);
        System.out.println("Found " + courses.size() + " courses:");
        for (var course : courses) {
            System.out.println(course);
        }
    }


}
