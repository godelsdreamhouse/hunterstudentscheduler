/**
 * @file JdbcCoursesRepository.java
 * @author Allison Gorman
 * @brief JDBC Implementation of CoursesRepository 
 */
package edu.hunter.watchtower.database;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import edu.hunter.watchtower.common.Course;

@Repository
public class JdbcCoursesRepository implements CoursesRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * @brief Finds courses by their code
     * @param courseCode The course code to search for
     * @return A list of courses matching the code
     */
    @Override
    public ArrayList<Course> findByCourseCode(String courseCode) {
        String sql = "SELECT * FROM courses WHERE course_code LIKE ?";
        ArrayList<Course> courses = new ArrayList<>();

        List<Course> result = jdbcTemplate.query(sql, new Object[] { "%" + courseCode + "%" },
                (ResultSet rs, int rowNum) -> {
                    Course course = new Course();
                    course.courseID = rs.getString("course_code").replaceAll("\\D", "").trim();
                    course.departmentCode = rs.getString("dep_code");
                    course.name = rs.getString("course_name");
                    course.credit = rs.getInt("credits");
                    return course;
                });
        courses.addAll(result);
        return courses;
    }

}
