## Directions
To build the binary, run:

```rust
cargo build --release
```

This assumes that you have rust tooling installed.
If not, check out [rustup](https://rustup.rs/).
If you are using an OS such as NixOS where rustup is not preferred, you're on your own.
Good luck.

### Server
To start the server, run:

```rust
./scraper serve -p 8080
```

### Client
The default URL is `http://127.0.0.1:8080`.

Routes:
- `/v1/course_list?skip=0&limit=20`
- `/v1/course_section?course_group_id=1209731&term_id=1262`
- `/v1/current_term`
- `/v1/all_terms`
- `/v1/course_requirements/:id`


Flow to get all info on a course:
1. Course list to get course id
2. Course requirements to get requirements
3. Current term to get current term
4. All terms to get all terms
    a. Filter terms to get current active ones
5. Course section for each active term to gets sections

To scrape all the data and populate the db, use `/v1/intialize`.
This can also be used to update all the data.

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

## Styling
This project uses `rustfmt`'s default style.
