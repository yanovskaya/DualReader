package com.lingua.api.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DatabaseConfig {

    @Bean
    @Primary
    public DataSource dataSource() throws Exception {
        String dbUrl = System.getenv("DATABASE_URL");
        if (dbUrl == null || dbUrl.isBlank()) {
            throw new IllegalStateException("DATABASE_URL environment variable is not set");
        }

        // Convert postgres://user:pass@host:port/db to JDBC format
        if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
            URI uri = new URI(dbUrl);
            String host = uri.getHost();
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String path = uri.getPath().replaceFirst("^/", "");
            String userInfo = uri.getUserInfo();
            String user = "";
            String password = "";
            if (userInfo != null) {
                String[] parts = userInfo.split(":", 2);
                user = parts[0];
                password = parts.length > 1 ? parts[1] : "";
            }
            dbUrl = String.format("jdbc:postgresql://%s:%d/%s", host, port, path);

            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(dbUrl);
            config.setUsername(user);
            config.setPassword(password);
            config.setMaximumPoolSize(10);
            config.setConnectionTimeout(30000);
            return new HikariDataSource(config);
        }

        // Already in JDBC format
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(dbUrl);
        config.setMaximumPoolSize(10);
        return new HikariDataSource(config);
    }
}
