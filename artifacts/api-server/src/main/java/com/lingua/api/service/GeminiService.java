package com.lingua.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private final HttpClient httpClient;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String baseUrl;
    private final String apiKey;

    public GeminiService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .version(HttpClient.Version.HTTP_1_1)
                .build();
        this.baseUrl = System.getenv("AI_INTEGRATIONS_GEMINI_BASE_URL");
        this.apiKey  = System.getenv("AI_INTEGRATIONS_GEMINI_API_KEY");
    }

    public boolean isAvailable() {
        return baseUrl != null && !baseUrl.isBlank();
    }

    /**
     * Generates an image using Gemini's native image generation.
     * Returns raw image bytes decoded from the base64 inline data.
     * model: "gemini-3-pro-image-preview" for high quality,
     *        "gemini-2.5-flash-image" for speed.
     */
    public byte[] generateImage(String prompt, String model) {
        try {
            String url = baseUrl.replaceAll("/+$", "") + "/models/" + model + ":generateContent";

            Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", prompt))
                )),
                "generationConfig", Map.of(
                    "responseModalities", List.of("IMAGE")
                )
            );

            String jsonBody = mapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(180))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
            }

            Map<?, ?> parsed = mapper.readValue(response.body(), Map.class);
            List<?> candidates = (List<?>) parsed.get("candidates");
            if (candidates == null || candidates.isEmpty()) {
                throw new RuntimeException("No candidates in Gemini response");
            }
            Map<?, ?> candidate = (Map<?, ?>) candidates.get(0);
            Map<?, ?> content = (Map<?, ?>) candidate.get("content");
            List<?> parts = (List<?>) content.get("parts");

            for (Object part : parts) {
                if (!(part instanceof Map<?, ?> partMap)) continue;
                Object inlineData = partMap.get("inlineData");
                if (!(inlineData instanceof Map<?, ?> idMap)) continue;
                String b64 = (String) idMap.get("data");
                if (b64 != null && !b64.isBlank()) {
                    return Base64.getDecoder().decode(b64);
                }
            }
            throw new RuntimeException("No inlineData image part in Gemini response");

        } catch (Exception e) {
            throw new RuntimeException("Gemini image generation failed [model=" + model + "]: " + e.getMessage(), e);
        }
    }
}
