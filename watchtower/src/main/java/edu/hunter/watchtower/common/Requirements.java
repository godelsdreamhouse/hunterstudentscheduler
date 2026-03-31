package edu.hunter.watchtower.common;

import lombok.Getter;

@Getter
public enum Requirements {
    // Hunter CUNY Common Core Requirements
    SCIWORLD("Scientific World"),
    QUANT("Mathematical and Quantitative Reasoning"),
    ENGCOMP("English Composition"),
    ENGCOMP2("English Composition"),
    SCI("Life & Physical Sciences"),
    CEXP("Creative Expression"),
    USDIV("U.S. Experiences in Its Diversity"),
    WORLD("World Cultures and Global Issues"),
    ISOSC("Individual and Society - Social Science"),
    IHUM("Individual and Society - Humanities, Cultures and Ideas"),
    PLURALA("Pluralism & Diversity Group A: Non-European Societies"),
    PLURALB("Pluralism & Diversity Group B: Groups in the U.S.A."),
    PLURALC("Pluralism & Diversity Group C: Women, Gender & Sexual Orientation"),
    PLURALD("Pluralism & Diversity Group D: European Societies");

    // Constructor
    private final String name;
    private Requirements(final String str) { name = str; }
    @Override public String toString() { return this.name; }
}
