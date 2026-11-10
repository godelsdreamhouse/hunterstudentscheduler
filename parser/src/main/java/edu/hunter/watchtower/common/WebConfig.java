/**
 * @file WebConfig.java
 * @author Jason Huang
 * @brief Contains the CORS configuration setting for the parser app
 */
package edu.hunter.watchtower.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    /**
     * @brief Adds Cors Mappings
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] configuredOrigins = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);

        registry.addMapping("/AuditParse")
                .allowedOriginPatterns(configuredOrigins)
                .allowedMethods("POST", "OPTIONS")
                .allowedHeaders("Content-Type")
                .maxAge(3600);
    }
}
