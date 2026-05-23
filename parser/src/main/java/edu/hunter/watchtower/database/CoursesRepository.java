/**
 * @file CoursesRepository.java
 * @author Allison Gorman
 * @brief Interface for accessing course information
 */
package edu.hunter.watchtower.database;

import java.util.ArrayList;

import edu.hunter.watchtower.common.Course;

public interface CoursesRepository {

    /**
     * @brief Expands a short hand reference to multiple courses into an ArrayList
     *        of all courses it refers to
     * @param courseCode The course ID and department code for the Course, e.g.
     *                   POLSC 294@
     * @return An ArrayList of all possible courses which the shortened course code
     *         could refer to
     */
    public ArrayList<Course> findByCourseCode(String courseCode);

}
