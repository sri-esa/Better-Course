# StudyFlow: Clustering Evaluation Report

This report evaluates topic clustering quality across three methods (`llm`, `embeddings`, `hybrid`).

## Summary Metrics

| Playlist | Subject | Method | Topics | Mean Topic (h) | Min (h) | Max (h) |
|---|---|---|---|---|---|---|
| Computer Networks | Computer Networks | `llm` | 6 | 1.83 | 1.50 | 2.17 |
| Computer Networks | Computer Networks | `embeddings` | 3 | 3.67 | 2.75 | 4.25 |
| Computer Networks | Computer Networks | `hybrid` | 3 | 3.67 | 2.75 | 4.25 |
| Data Structures | Data Structures | `llm` | 6 | 1.83 | 1.50 | 2.17 |
| Data Structures | Data Structures | `embeddings` | 3 | 3.67 | 2.75 | 4.25 |
| Data Structures | Data Structures | `hybrid` | 3 | 3.67 | 2.75 | 4.25 |
| Calculus | Calculus | `llm` | 6 | 1.83 | 1.50 | 2.17 |
| Calculus | Calculus | `embeddings` | 3 | 3.67 | 2.75 | 4.25 |
| Calculus | Calculus | `hybrid` | 3 | 3.67 | 2.75 | 4.25 |

## Boundary Agreement (Pairwise Jaccard Index)

| Playlist | LLM vs Embeddings | LLM vs Hybrid | Embeddings vs Hybrid |
|---|---|---|---|
| Computer Networks | 0.0% | 0.0% | 100.0% |
| Data Structures | 0.0% | 0.0% | 100.0% |
| Calculus | 0.0% | 0.0% | 100.0% |

## Qualitative Topic Breakdown

### Playlist: Computer Networks (Standard undergraduate networking playlist)

| Topic # | LLM Topic (Range) | Embeddings Topic (Range) | Hybrid Topic (Range) | Human Sense Rating (1-5) |
|---|---|---|---|---|
| 1 | Topic 1 Fundamentals (0-3) | Lecture 1: OSI Model Architecture (0-9) | Lecture 1: OSI Model Architecture (0-9) | [ ] |
| 2 | Topic 2 Fundamentals (4-7) | Lecture 11: BGP and OSPF Protocols (10-17) | Lecture 11: BGP and OSPF Protocols (10-17) | [ ] |
| 3 | Topic 3 Fundamentals (8-11) | Lecture 19: OSI Model Architecture (18-23) | Lecture 19: OSI Model Architecture (18-23) | [ ] |
| 4 | Topic 4 Fundamentals (12-15) | - | - | [ ] |
| 5 | Topic 5 Fundamentals (16-19) | - | - | [ ] |
| 6 | Topic 6 Fundamentals (20-23) | - | - | [ ] |

### Playlist: Data Structures (MyCodeSchool popular DSA playlist)

| Topic # | LLM Topic (Range) | Embeddings Topic (Range) | Hybrid Topic (Range) | Human Sense Rating (1-5) |
|---|---|---|---|---|
| 1 | Topic 1 Fundamentals (0-3) | Lecture 1: Introduction to Space and Time Compl... (0-9) | Lecture 1: Introduction to Space and Time Compl... (0-9) | [ ] |
| 2 | Topic 2 Fundamentals (4-7) | Lecture 11: Balanced Trees AVL (10-17) | Lecture 11: Balanced Trees AVL (10-17) | [ ] |
| 3 | Topic 3 Fundamentals (8-11) | Lecture 19: Asymptotic Notations (18-23) | Lecture 19: Asymptotic Notations (18-23) | [ ] |
| 4 | Topic 4 Fundamentals (12-15) | - | - | [ ] |
| 5 | Topic 5 Fundamentals (16-19) | - | - | [ ] |
| 6 | Topic 6 Fundamentals (20-23) | - | - | [ ] |

### Playlist: Calculus (MIT OpenCourseWare single variable calculus)

| Topic # | LLM Topic (Range) | Embeddings Topic (Range) | Hybrid Topic (Range) | Human Sense Rating (1-5) |
|---|---|---|---|---|
| 1 | Topic 1 Fundamentals (0-3) | Lecture 1: Limits Intuition and Formal Definition (0-9) | Lecture 1: Limits Intuition and Formal Definition (0-9) | [ ] |
| 2 | Topic 2 Fundamentals (4-7) | Lecture 11: Fundamental Theorem of Calculus (10-17) | Lecture 11: Fundamental Theorem of Calculus (10-17) | [ ] |
| 3 | Topic 3 Fundamentals (8-11) | Lecture 19: Derivatives from First Principles (18-23) | Lecture 19: Derivatives from First Principles (18-23) | [ ] |
| 4 | Topic 4 Fundamentals (12-15) | - | - | [ ] |
| 5 | Topic 5 Fundamentals (16-19) | - | - | [ ] |
| 6 | Topic 6 Fundamentals (20-23) | - | - | [ ] |