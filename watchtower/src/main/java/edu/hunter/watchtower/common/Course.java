package edu.hunter.watchtower.common;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class Course {
    public int courseID;
    public String departmentCode;
    public String name;

    @Override
    public String toString() {
        return departmentCode + " " + String.valueOf(courseID) + " " + name;
    }
}
