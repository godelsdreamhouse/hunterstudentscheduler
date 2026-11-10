package edu.hunter.watchtower.PDFParser;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
class PDFUploadExceptionHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, String>> handleOversizedUpload() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .cacheControl(CacheControl.noStore())
                .body(Map.of("ERROR", "Upload exceeds the 5MB PDF or 6MB total request limit"));
    }
}
