# System Design in an Hour: Crash Course

This section summarizes the fundamental concepts required for systems design, providing a high-level overview of databases, replication, sharding, and processing frameworks.

<h2 id="databases-and-indexes">1. Databases & Indexes</h2>

Databases store application state durably on a hard drive. To optimize performance, related data that is read or written together should be kept close on disk.

### The Write-Ahead Log (WAL)
If we only want to optimize for **writes**, we can append data to a sequential **Write-Ahead Log**. Sequential operations on a hard drive are always faster than random accesses.
- **Writes** are O(1) and fast.
- **Reads** require a sequential scan O(N), which is slow.

To improve reads, databases use **Indexes**.

### Types of Indexes

| Index Type | Structure | Pros | Cons |
|---|---|---|---|
| **Hash Index** | In-memory Hash Map mapping keys to disk addresses. | O(1) reads/writes. | Key set must fit in memory; poor support for range queries. |
| **B+ Trees** | Tree structure of pointers on disk. | Logarithmic O(log N) reads/writes. Excellent for range queries. | Slower writes than hash indexes due to tree balancing. |
| **LSM Trees & SSTables** | Writes go to in-memory BST, flushed to sorted files on disk. | Very fast writes. High throughput. | Reads are slower (must check memory then multiple disk tables). |

<div class="mermaid">
graph TD
    A[B+ Tree Root] --> B[Keys 1-10]
    A --> C[Keys 11-20]
    B --> D[Data 1-5]
    B --> E[Data 6-10]
    C --> F[Data 11-15]
    C --> G[Data 16-20]
</div>

<h2 id="transactions">2. Transactions & Concurrency</h2>

Transactions ensure that multi-step operations on a database are safe from concurrency issues and hardware failures. This is commonly summarized by **ACID** properties.

### Concurrency Control
When multiple transactions execute simultaneously, databases must avoid conflicts:

1. **Pessimistic Concurrency Control**: Uses locks. Transactions lock rows they are reading/writing. Good when there is high contention.
2. **Optimistic Concurrency Control**: Allows transactions to proceed without locks, but checks for conflicts right before committing. If data changed, the transaction aborts and retries. Good for low contention.

<h2 id="storage-and-serialization">3. Storage Models & Serialization</h2>

### Row vs. Columnar Storage
- **Row-Based Storage**: Keeps all fields of a record together on disk. Ideal for transactional queries (OLTP) like reading a user's entire profile.
- **Columnar Storage**: Keeps all values of a single column together. Ideal for analytical queries (OLAP) because you only read the columns you need, and data compresses extremely well.

### Data Serialization
When transmitting data over the network or storing it:
- **JSON**: Flexible, schema-less, human-readable, but verbose (field names included in every message).
- **Protocol Buffers (Protobuf)**: Pre-defined strongly-typed schema. Compact binary format, saving significant network bandwidth and storage.

<h2 id="replication">4. Replication</h2>

Replication copies data across multiple machines to tolerate hardware failures and improve read performance.

### Replication Topologies

<div class="mermaid">
flowchart LR
    subgraph Single Leader
      L1[Leader] -->|Replicates| F1[Follower]
      L1 -->|Replicates| F2[Follower]
    end
    
    subgraph Multi-Leader
      ML1[Leader 1] <-->|Syncs| ML2[Leader 2]
    end
</div>

- **Single Leader**: One database accepts writes; multiple followers serve reads. Pros: Simple. Cons: Write throughput is bottlenecked; failover causes downtime.
- **Multi-Leader**: Multiple nodes accept writes. Pros: Higher write throughput. Cons: Leads to **write conflicts**.
- **Leaderless**: Any node accepts reads and writes. Quorums are used to ensure consistency (W + R > N). Pros: High availability. Cons: High latency, complex conflict resolution.

### Conflict Resolution (Version Vectors)
In multi-leader or leaderless systems, concurrent writes can conflict. **Version Vectors** track how many writes each node has seen. If vectors interleave (neither is strictly greater), a concurrent conflict is detected, and the database stores both versions as "siblings" for the client to resolve later.

<h2 id="sharding-and-partitioning">5. Sharding (Partitioning)</h2>

Sharding splits a large database into smaller partitions (shards) across multiple machines.

### Sharding Strategies
1. **Key Range**: Partitions by a range of keys (e.g., A-M, N-Z). Pros: Supports range queries. Cons: Prone to hotspots.
2. **Key Hash**: Partitions by the hash of the key. Pros: Evenly distributes data. Cons: Destroys range query capabilities.

### Consistent Hashing
If we use modulo arithmetic (hash(key) % N) to shard, adding a node requires migrating almost all keys. 
**Consistent Hashing** places nodes and keys on a circular ring. A key belongs to the first node found by walking clockwise. Adding a node only redistributes a small fraction of keys.

<div class="mermaid">
graph TD
    subgraph Consistent Hashing Ring
      NodeA((Node A)) --- NodeB((Node B))
      NodeB --- NodeC((Node C))
      NodeC --- NodeA
      K1[Key 1] -.-> NodeB
      K2[Key 2] -.-> NodeA
    end
</div>

### Secondary Indexes in Sharded DBs
- **Local Secondary Index**: Exists only within a single shard. Writes are fast, but reads require scatter-gather (querying all shards).
- **Global Secondary Index**: A separate partitioned index covering all shards. Reads are fast, but writes require updating multiple shards asynchronously.

<h2 id="processing-frameworks">6. Processing Frameworks</h2>

When analyzing massive datasets that cannot be handled by a single machine, we use distributed processing frameworks.

- **Batch Processing** (e.g., MapReduce, Spark): Analyzes massive, static datasets offline. Frameworks handle distributed state, worker node failures, and data checkpoints automatically.
- **Stream Processing**: Processes endless streams of events in real-time or near real-time.

### Message Brokers
Stream processing relies on brokers to route events from producers to consumers.
- **In-Memory Message Brokers** (e.g., RabbitMQ): Queues in memory. Supports fast round-robin delivery to many workers. Cons: Unordered, and can run out of memory if workers are too slow.
- **Log-Based Message Brokers** (e.g., Kafka): Persists events to an append-only log on disk. Consumes sequentially. Pros: Durable, replayable, and highly scalable.

<h2 id="choosing-a-database">7. Choosing a Database</h2>

Selecting the right database depends on the specific requirements of your system. Here is a breakdown of common options and their trade-offs.

### SQL Databases (Relational)
- **Data Model**: Relational, normalized data stored in rows and tables.
- **Transactions**: Provides strong **ACID guarantees** and serializability. If you write to multiple tables, the transaction fully succeeds or fails (often using two-phase locking/commit).
- **Under the Hood**: Uses B-Trees, which provide fast reads but slower writes. 
- **Use Cases**: When **correctness** is more important than speed (e.g., Financial transactions, Job scheduling systems).

### NoSQL Databases

#### MongoDB (Document Store)
- **Data Model**: Data is stored as JSON-like documents. Allows nesting related data (e.g., an author and all their books in one document) providing excellent **data locality**.
- **Use Cases**: When your data naturally fits a document model and is frequently accessed together. Note: Denormalization can lead to out-of-sync data if not carefully managed.

#### Cassandra & Riak (Wide-Column / Key-Value)
- **Replication**: Typically configured as **Leaderless** or Multi-Leader. Provides extreme availability and scalability.
- **Under the Hood**: Uses **LSM Trees** and SSTables for extremely fast writes. 
- **Conflict Resolution**: Cassandra uses "Last Write Wins" (which can clobber data). Riak uses **CRDTs** (Conflict-free Replicated Data Types) for more advanced conflict resolution.
- **Use Cases**: When you need **very high write throughput** and can tolerate eventual consistency (e.g., Chat messages, logging).

#### Apache HBase
- **Data Model**: Wide-column store, but differs from Cassandra by using **Columnar Storage** instead of row-wise storage. 
- **Replication**: Uses **Single Leader** replication backed by Hadoop Distributed File System (HDFS).
- **Use Cases**: When you need fast reads on specific columns of data (e.g., quickly fetching a column of images).

#### Memcached & Redis (In-Memory Key-Value)
- **Storage**: Data is stored entirely in **RAM** rather than on disk. Does not use B-Trees or LSM Trees; typically uses Hash Maps.
- **Performance**: Ultra-fast O(1) reads and writes, but more expensive per gigabyte. Poor for range queries.
- **Use Cases**: Caching layers, leaderboards, or highly accessed transient data (e.g., live geospatial indexes).

#### Neo4j (Graph Database)
- **Data Model**: Stores data as nodes and edges with direct pointers on disk, allowing constant-time O(1) traversals.
- **Comparison**: Implementing a graph in SQL requires many-to-many join tables with O(log N) index lookups per hop.
- **Use Cases**: Highly interconnected data like social networks (friends of friends) or map routing.

#### Time Series Databases
- **Under the Hood**: Uses modified LSM trees that break data into many small, in-memory chunks. This allows dropping old data efficiently by simply deleting the index chunks rather than waiting for slow compaction and tombstones.
- **Use Cases**: Ingesting massive amounts of timestamped metrics, IoT sensor data, or logs.

### Honorable Mentions
- **VoltDB**: A SQL database that runs entirely in-memory on a single CPU thread. No locking overhead because there are no concurrent operations. Extremely fast but limited by memory size.
- **Google Spanner**: A distributed SQL database that uses TrueTime (atomic clocks and GPS receivers in data centers) to globally order transactions, achieving strong consistency at massive scale without standard locking bottlenecks.
