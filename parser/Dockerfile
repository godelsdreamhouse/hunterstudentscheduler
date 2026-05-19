FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x ./mvnw
# RUN ./mvn dependency:go-offline
COPY src/ src/
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre
COPY --from=build /app/target/watchtower-0.0.1-SNAPSHOT.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
EXPOSE 8080


