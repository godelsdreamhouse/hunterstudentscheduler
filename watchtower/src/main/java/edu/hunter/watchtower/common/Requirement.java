package edu.hunter.watchtower.common;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public enum Requirement {
    // Hunter CUNY Common Core Requirements
    SCIWORLD("Scientific World"),
    QUANT("Mathematical and Quantitative Reasoning"),
    ENGCOMP("English Composition"),
    SCI("Life & Physical Sciences"),
    CEXP("Creative Expression"),
    USDIV("U.S. Experiences in its Diversity"),
    WORLD("World Cultures and Global Issues"),
    ISOSC("Individual and Society - Social Science"),
    IHUM("Individual and Society - Humanities, Cultures and Ideas"),
    WRITING("Writing Requirement"),
    PLURALA("Pluralism & Diversity Group A: Non-European Societies"),
    PLURALB("Pluralism & Diversity Group B: Groups in the U.S.A."),
    PLURALC("Pluralism & Diversity Group C: Women, Gender & Sexual Orientation"),
    PLURALD("Pluralism & Diversity Group D: European Societies");

    // Constructor
    private final String name;
    private Requirement(final String str) {name = str;}
}
