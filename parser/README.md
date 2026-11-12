# parser

## Introduction

This folder is the implementation of the Audit parser for Watchtower Scheduling as a Spring Boot application. It parses a PDF (or .txt file for testing purposes) of a DegreeWorks Audit and extracts information, e.g. major(s), completed courses, still needed requirements, etc., from it. It takes a MultiPartFile object as input from the UI and returns to the UI the extracted information. The return payload will be elaborated on below.  

Currently, the parser is only configured to accept the following degree programs:  
Format: Major, Concentration
    - U Computer Science, U Computer Science
    - U Mathematics, U Mathematics
    - U Political Science, None

## Structure

```text
parser/
    .mvn/wrapper                                            Maven config
    src/
        main/
            java/edu/hunter/watchtower
                common/                                     Common data structures and Web Config
                database/                                   Interface and Repository for interacting with the Database
                PDFParser/                                  Implementation of Parser, including the Controller
                ParserApplication.java                      Application startup
            resources/                                      
                application.properties                      Spring application properties variables
                exampleAudit.txt                            Shortened example Audit txt file for testing
        test/                                               Tests main classes and application startup
    .env.example                                            Example for .env file.
    .gitattributes                                          Git attributes
    .gitignore                                              Git ignore
    Dockerfile                                              Docker config
    mvnw                                                    Maven start up script
    mvnw.cmd                                                Maven start up script
    pom.xml                                                 Requirements
    README.md                                               This file
```

## Setup

The Dockerfile copies files from both `parser/` and `infrastructure/`, so build
it from the repository root:

```bash
docker build -f parser/Dockerfile -t satisfi-parser:local .
docker run --rm -p 127.0.0.1:8080:8080 \
  --network database_default \
  -e SPRING_DATASOURCE_USERNAME=watchtower \
  -e SPRING_DATASOURCE_PASSWORD=watchtower_password \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/watchtower \
  -e CORS_ALLOWED_ORIGINS=http://localhost:5176 \
  satisfi-parser:local
```

This command assumes the database was started by the repository's default
Compose command, which creates network `database_default` and service hostname
`postgres`. See
[`docs/LOCAL_DEVELOPMENT.md`](../docs/LOCAL_DEVELOPMENT.md) for a complete local
stack example.

To run directly with Java instead, pass the environment variables to Maven;
Spring does not load `parser/.env` automatically:

```bash
SPRING_DATASOURCE_USERNAME=watchtower \
SPRING_DATASOURCE_PASSWORD=watchtower_password \
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/watchtower \
CORS_ALLOWED_ORIGINS=http://localhost:5176 \
SERVER_ADDRESS=127.0.0.1 \
./parser/mvnw -f parser/pom.xml spring-boot:run
```

Do not put local credentials into `application.properties`.

## Deployment

## Style Standard and Documentation

This application uses the [https://github.com/google/styleguide/blob/gh-pages/eclipse-java-google-style.xml]Google Style Standard. See the official [https://google.github.io/styleguide/javaguide.html]Style Guide for more information. All methods use Javadoc comments for documentation.

## Output payload

### Fields

- `Major`: `list[String]`, example: `["Computer Science", "Mathematics"]`
- `Minor`: `list[String]`, example: `["Philosophy"]`
- `Concentration`: `list[String]`, example: `["Computer Science"]`
- `Degree Credits`: `Map[String, Object]`, see below for `Degree Credits` structure
- `MajorInfo`: `Map[String, Object]`, see below for `MajorInfo` structure
- `Completed`: `list[Requirement]`, see below for `Requirement` structure
- `Still Needed`: `list[Requirement]`

### Degree Credits

Holds information about the user's number of credits taken and needed.  
Structure:

- `Status`: `String`, either `"Completed"` or `"Still Needed"`
- `Credits applied:`: `float`, example: `86.3`
- `Credits required`: `float`, example `120.0`

### MajorInfo

Holds information about the number of credits needed and taken for each major.  
Structure:

- `MajorCredits_${Major_Name}`: `Degree Credits` object, see above

Example:

```text
MajorInfo:
    MajorCredits_Computer Science:
        Status: Completed
        Credits applied: 54.3
        Credits required: 51.0
```

### Requirement

- `name`: `String`, example: `"English Composition"`
- `tag`: `String`, example: `"CUNYcommon"`
- `courses`: `list[Course]`, if completed, list containing just the course which satisfied the Requirement; else, list of courses which satisfy the Requirement; see below for `Course` structure
- `exceptions`: `list[Course]`, possible exceptions to the requirement, nullable
- `credits`: `float`, number of credits needed to satisfy the Requirement

### Course

- `courseID`: `String`, example: `"49900"`
- `departmentCode`: `String`, example: `"CSCI"`
- `name`: `String`, example: `"Advanced Applications: A Capstone for Majors"`
- `grade`: `String`, examples: `"A-"` or `"IP"`
- `credit`: `float`, example: `3.3`

## AI Reflection

For most of this project's development, no AI was used to write code for the parser. An update to VSCode introduced GitHub Copilot powered next line suggestions (see [https://code.visualstudio.com/docs/copilot/ai-powered-suggestions]here for more information), with a cap on number of suggestions. This update was downloaded May 9th. The cap on Copilot suggestions was hit on May 18th. During that period, AI was used to autocomplete Javadoc comments and some code changes, specifically for AuditParser.getGPA(), .getMajor(), .getHunterFocus(), .getElectives(), and .getWritingRequirement(). Most suggestions were not used, as, since they were based on available context, they were not useful for adding something new, e.g. having to use a different regex Pattern to extract Hunter Focus information. The suggestions accepted was used for code and documentation which were similar to prior examples, e.g. TextRefiner's Javadoc documentation, which follows has much of the same information.
