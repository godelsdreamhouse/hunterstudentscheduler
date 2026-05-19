package edu.hunter.watchtower.PDFParser;

import java.util.ArrayList;

import edu.hunter.watchtower.common.Course;

public interface CoursesRepository {

    public ArrayList<Course> findByCourseCode(String courseCode);

}
