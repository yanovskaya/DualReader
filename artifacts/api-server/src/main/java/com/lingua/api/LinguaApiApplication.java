package com.lingua.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class LinguaApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(LinguaApiApplication.class, args);
    }
}
