package com.lingua.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class OpenAiService {

    private final HttpClient httpClient;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String apiKey;
    private final String apiUrl;

    public OpenAiService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .build();

        // Prefer Replit AI Integration credentials, fall back to direct OpenAI key
        String integrationBaseUrl = System.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL");
        String integrationApiKey  = System.getenv("AI_INTEGRATIONS_OPENAI_API_KEY");

        if (integrationBaseUrl != null && !integrationBaseUrl.isBlank()) {
            String base = integrationBaseUrl.replaceAll("/+$", "");
            this.apiUrl = base + "/chat/completions";
            this.apiKey = (integrationApiKey != null) ? integrationApiKey : "dummy";
        } else {
            this.apiUrl = "https://api.openai.com/v1/chat/completions";
            this.apiKey = System.getenv("OPENAI_API_KEY");
        }
    }

    public String complete(String model, int maxTokens, List<Map<String, String>> messages) {
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_completion_tokens", maxTokens,
                    "messages", messages
            );

            String jsonBody = mapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
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
            throw new RuntimeException("OpenAI API call failed [url=" + apiUrl + "]: " + e.getMessage(), e);
        }
    }
}
