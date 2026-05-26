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
public class OpenAiService {

    private final HttpClient httpClient;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String apiKey;
    private final String chatUrl;
    private final String imageUrl;

    public OpenAiService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .build();

        String integrationBaseUrl = System.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL");
        String integrationApiKey  = System.getenv("AI_INTEGRATIONS_OPENAI_API_KEY");

        if (integrationBaseUrl != null && !integrationBaseUrl.isBlank()) {
            String base = integrationBaseUrl.replaceAll("/+$", "");
            this.chatUrl  = base + "/chat/completions";
            this.imageUrl = base + "/images/generations";
            this.apiKey   = (integrationApiKey != null) ? integrationApiKey : "dummy";
        } else {
            this.chatUrl  = "https://api.openai.com/v1/chat/completions";
            this.imageUrl = "https://api.openai.com/v1/images/generations";
            this.apiKey   = System.getenv("OPENAI_API_KEY");
        }
    }

    /** Chat completion — returns the assistant message content. */
    public String complete(String model, int maxTokens, List<Map<String, String>> messages) {
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_completion_tokens", maxTokens,
                    "messages", messages
            );

            String jsonBody = mapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(chatUrl))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            Map<?, ?> parsed = mapper.readValue(response.body(), Map.class);
            List<?> choices = (List<?>) parsed.get("choices");
            if (choices == null || choices.isEmpty()) return "";
            Map<?, ?> first = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) first.get("message");
            return message == null ? "" : String.valueOf(message.get("content"));
        } catch (Exception e) {
            throw new RuntimeException("OpenAI chat API failed [url=" + chatUrl + "]: " + e.getMessage(), e);
        }
    }

    /**
     * Image generation via gpt-image-1.
     * Returns raw PNG bytes decoded from the base64 response.
     * Size must be one of: 1024x1024, 1536x1024, 1024x1536, auto.
     */
    public byte[] imageGenerate(String prompt, String size) {
        try {
            Map<String, Object> body = Map.of(
                    "model", "gpt-image-1",
                    "prompt", prompt,
                    "size", size,
                    "n", 1
            );

            String jsonBody = mapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(imageUrl))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
            }

            Map<?, ?> parsed = mapper.readValue(response.body(), Map.class);
            List<?> data = (List<?>) parsed.get("data");
            if (data == null || data.isEmpty()) {
                throw new RuntimeException("No image data in response");
            }
            Map<?, ?> first = (Map<?, ?>) data.get(0);
            String b64 = (String) first.get("b64_json");
            if (b64 == null || b64.isBlank()) {
                throw new RuntimeException("Empty b64_json in response");
            }
            return Base64.getDecoder().decode(b64);
        } catch (Exception e) {
            throw new RuntimeException("gpt-image-1 failed [url=" + imageUrl + "]: " + e.getMessage(), e);
        }
    }
}
