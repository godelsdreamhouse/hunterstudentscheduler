package edu.hunter.watchtower.common;
import java.util.ArrayList;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class Requirement {
    public String name; // example: Software Analysis and Design I
    public String tag; // example: Computer Science major
    public ArrayList<Course> courses; // example: { {Software Analysis and Design 1} }
    public float credits;

    @Override
    public String toString() {
        return name + ", " + tag + ": " + courses.toString();
    }
}
