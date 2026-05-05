package com.lingua.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${CLERK_PUBLISHABLE_KEY:}")
    private String clerkPublishableKey;

    /**
     * Derives the Clerk JWKS URI from the publishable key.
     * Format: pk_{env}_{base64url(frontend_api_host + "$")}
     */
    private String deriveJwksUri() {
        if (clerkPublishableKey == null || clerkPublishableKey.isBlank()) {
            throw new IllegalStateException("CLERK_PUBLISHABLE_KEY is not set");
        }
        String payload = clerkPublishableKey.replaceFirst("^pk_[^_]+_", "");
        int rem = payload.length() % 4;
        if (rem == 2) payload += "==";
        else if (rem == 3) payload += "=";
        byte[] decoded = Base64.getUrlDecoder().decode(payload);
        String host = new String(decoded, StandardCharsets.UTF_8).replaceAll("\\$$", "");
        return "https://" + host + "/.well-known/jwks.json";
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.decoder(
                    NimbusJwtDecoder.withJwkSetUri(deriveJwksUri()).build()
                ))
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            );
        return http.build();
    }
}
