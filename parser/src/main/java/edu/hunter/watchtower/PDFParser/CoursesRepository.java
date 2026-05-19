/**
 * @file CoursesRepository.java
 * @author Allison Gorman
 * @brief Interface for accessing course information
 */
package edu.hunter.watchtower.PDFParser;

import java.util.ArrayList;

import edu.hunter.watchtower.common.Course;

public interface CoursesRepository {

    public ArrayList<Course> findByCourseCode(String courseCode);

}
