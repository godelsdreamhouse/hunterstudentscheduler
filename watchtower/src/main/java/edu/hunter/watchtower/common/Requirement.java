package edu.hunter.watchtower.common;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
public class Requirement {
    public String name;
    public String type;

    @Override
    public String toString() {
        return type + " " + name;
    }
}
