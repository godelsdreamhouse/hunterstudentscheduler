## Testing
To run test functions, run:

```rust
cargo test
```

To run test function with JSON outputs, run:

```rust
cargo test -- --nocapture
```

To run specific test functions, run:

```rust
cargo test test_function_name
```

>[!note]
>The above command may match other test functions with the same substrings.
>To run a stricter search, run:
>
>```rust
>cargo test test_function_name -- --exact
>```
