package edu.hunter.watchtower.PDFParser;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import edu.hunter.watchtower.common.Requirement;

class SupportedMajorContractFixtureTests {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void sharedFixturesMatchParserResponseSerialization()
            throws IOException, URISyntaxException {
        JsonNode contract = mapper.readTree(Files.readString(fixturePath()));
        List<String> expectedMajors = List.of(
                "Computer Science",
                "Mathematics",
                "Political Science");

        for (int index = 0; index < expectedMajors.size(); index++) {
            JsonNode response = contract.get("cases").get(index).get("raw_parser_response");
            assertEquals(expectedMajors.get(index), response.get("Major").get(0).asText());

            assertRequirementRoundTrip(response.get("Completed").get(0));
            assertRequirementRoundTrip(response.get("Still Needed").get(0));
        }
    }

    private void assertRequirementRoundTrip(JsonNode expected) throws IOException {
        Requirement requirement = mapper.treeToValue(expected, Requirement.class);
        JsonNode serialized = mapper.valueToTree(requirement);
        Set<String> serializedFields = new HashSet<>();
        serialized.fieldNames().forEachRemaining(serializedFields::add);

        assertEquals(
                Set.of("name", "tag", "courses", "exceptions", "credits"),
                serializedFields);
        assertEquals(expected.get("name").asText(), serialized.get("name").asText());
        assertEquals(expected.get("tag").asText(), serialized.get("tag").asText());
        assertEquals(expected.get("credits").asDouble(), serialized.get("credits").asDouble(), 0.0001);
        assertEquals(expected.get("exceptions").size(), serialized.get("exceptions").size());
        assertEquals(expected.get("courses").size(), serialized.get("courses").size());

        JsonNode expectedCourse = expected.get("courses").get(0);
        JsonNode serializedCourse = serialized.get("courses").get(0);
        Set<String> serializedCourseFields = new HashSet<>();
        serializedCourse.fieldNames().forEachRemaining(serializedCourseFields::add);
        assertEquals(
                Set.of("courseID", "departmentCode", "name", "grade", "credit"),
                serializedCourseFields);
        assertEquals(expectedCourse.get("courseID"), serializedCourse.get("courseID"));
        assertEquals(expectedCourse.get("departmentCode"), serializedCourse.get("departmentCode"));
        assertEquals(expectedCourse.get("name"), serializedCourse.get("name"));
        assertEquals(expectedCourse.get("grade"), serializedCourse.get("grade"));
        assertEquals(expectedCourse.get("credit").asDouble(), serializedCourse.get("credit").asDouble(), 0.0001);
    }

    private Path fixturePath() throws URISyntaxException {
        Path testClasses = Path.of(
                SupportedMajorContractFixtureTests.class
                        .getProtectionDomain()
                        .getCodeSource()
                        .getLocation()
                        .toURI());
        Path repositoryRoot = testClasses.getParent().getParent().getParent();
        return repositoryRoot
                .resolve("test-fixtures")
                .resolve("contracts")
                .resolve("supported-major-audits.json");
    }
}
