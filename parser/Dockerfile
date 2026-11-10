FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY parser/.mvn/ .mvn/
COPY parser/mvnw parser/pom.xml ./
RUN chmod +x ./mvnw
# RUN ./mvn dependency:go-offline
COPY parser/src/ src/
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.1 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=build /app/target/watchtower-0.0.1-SNAPSHOT.jar app.jar
COPY infrastructure/rds-ca-global.pem /opt/rds-ca-global.pem
ENV PORT=8080 \
    AWS_LWA_PORT=8080 \
    AWS_LWA_READINESS_CHECK_PATH=/actuator/health \
    AWS_LWA_ASYNC_INIT=true \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java","-jar","/app.jar"]
EXPOSE 8080
