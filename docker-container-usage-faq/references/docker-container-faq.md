# Docker Container FAQ and Command Reference

## 快速命令

查看环境：

```bash
docker version
docker info
docker context ls
docker system df
```

查看容器：

```bash
docker ps
docker ps -a
docker inspect CONTAINER
docker logs --tail 200 CONTAINER
docker logs -f CONTAINER
```

查看镜像、网络和数据卷：

```bash
docker image ls
docker network ls
docker volume ls
docker volume inspect VOLUME
```

运行服务：

```bash
docker run -d --name web -p 8080:80 nginx:1.27
```

运行带环境变量和 volume 的服务：

```bash
docker run -d --name app \
  --env APP_ENV=dev \
  --volume app-data:/var/lib/app \
  --publish 8080:8080 \
  --restart unless-stopped \
  IMAGE
```

PowerShell 中使用当前目录 bind mount：

```powershell
docker run --rm -it -v "${PWD}:/workspace" -w /workspace IMAGE sh
```

Linux/macOS 中使用当前目录 bind mount：

```bash
docker run --rm -it -v "$(pwd):/workspace" -w /workspace IMAGE sh
```

构建镜像：

```bash
docker build -t app:dev .
docker build --no-cache -t app:dev .
```

推送镜像：

```bash
docker tag app:dev registry.example.com/team/app:1.0.0
docker push registry.example.com/team/app:1.0.0
```

Compose：

```bash
docker compose up -d
docker compose ps
docker compose logs -f
docker compose logs -f SERVICE
docker compose exec SERVICE sh
docker compose down
```

## 低风险清理

优先查看占用：

```bash
docker system df
```

删除已退出容器：

```bash
docker container prune
```

删除悬空镜像：

```bash
docker image prune
```

谨慎命令：

```bash
docker system prune -a
docker volume prune
docker compose down -v
```

这些命令可能删除仍需回滚的镜像或持久化数据。除非用户确认，否则不要把它们作为第一步。

## FAQ

### 1. Cannot connect to the Docker daemon

常见原因：

- Docker Desktop 或 Docker daemon 未启动。
- 当前用户没有访问 Docker socket 的权限。
- `DOCKER_HOST` 或 Docker context 指向了错误环境。

排查：

```bash
docker version
docker context ls
docker info
```

Linux 权限问题通常需要把用户加入 `docker` 组并重新登录；生产服务器上也可以用 `sudo docker ...` 验证是否为权限问题。

### 2. 端口已经被占用

报错通常包含 `port is already allocated` 或 `bind: address already in use`。

排查：

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

修复：

- 换宿主机端口：`-p 8081:80`。
- 停掉占用端口的容器或宿主机进程。
- Compose 中修改左侧端口，例如 `"8081:80"`。

### 3. 容器启动后马上退出

容器需要一个前台进程。进程退出，容器就退出。

排查：

```bash
docker ps -a
docker logs --tail 200 CONTAINER
docker inspect --format '{{.State.ExitCode}} {{.State.Error}}' CONTAINER
```

常见修复：

- 修正 `CMD`/`ENTRYPOINT`。
- 补齐环境变量或配置文件。
- 确保应用监听前台，不要把主进程放到后台。

### 4. 宿主机访问不到容器服务

检查顺序：

1. 容器是否运行：`docker ps`。
2. 端口是否映射：`docker port CONTAINER`。
3. 应用是否监听容器内正确端口。
4. 应用是否监听 `0.0.0.0`，而不是只监听 `127.0.0.1`。
5. 防火墙、安全组或代理是否拦截。

### 5. 容器内的 localhost 为什么连不到宿主机或其他容器

容器内 `localhost` 指向容器自身。连接其他目标时：

- 连接同一 Compose 项目的服务：使用服务名，例如 `db:5432`。
- Docker Desktop 访问宿主机：使用 `host.docker.internal`。
- Linux 访问宿主机：可配置 `--add-host=host.docker.internal:host-gateway` 后使用同名主机。

### 6. Bind mount 后镜像里的文件消失

bind mount 会把宿主机路径覆盖到容器路径上。如果宿主机目录为空，容器中原路径下的镜像文件会被遮住。

修复：

- 挂载到单独目录。
- 只挂载具体配置文件。
- 先把镜像内初始化文件复制到宿主机目录。

### 7. Permission denied

常见原因：

- 容器以非 root 用户运行，但挂载目录归宿主机其他用户所有。
- 宿主机目录权限不足。
- SELinux 阻止访问。
- Windows/WSL 文件共享路径未授权。

排查：

```bash
docker exec CONTAINER id
docker exec CONTAINER ls -la /path
docker inspect --format '{{json .Mounts}}' CONTAINER
```

修复方向：

- 调整宿主机目录所有者或权限。
- 让容器运行用户 UID/GID 与宿主机目录匹配。
- SELinux 环境可按项目规范使用 `:z` 或 `:Z` 标记。

### 8. no space left on device

先确认 Docker 占用：

```bash
docker system df
docker ps -a --size
docker image ls
docker volume ls
```

安全处理顺序：

1. 删除无用停止容器。
2. 删除无用悬空镜像。
3. 确认哪些 named volume 不再需要。
4. 再考虑扩大 Docker Desktop 磁盘或服务器分区。

不要未经确认删除 volume，数据库和上传文件常在其中。

### 9. docker exec 报 no such file or directory 或找不到 bash

精简镜像可能没有 `bash`。尝试：

```bash
docker exec -it CONTAINER sh
```

如果镜像连 shell 都没有，用日志、`docker inspect`、临时 debug 镜像或重新构建带调试工具的开发镜像。

### 10. Dockerfile 修改后构建结果没变化

可能是缓存命中或构建上下文没有包含文件。

排查：

```bash
docker build --no-cache -t app:debug .
```

检查 `.dockerignore` 是否排除了必要文件，检查 `COPY` 路径是否相对于构建上下文。

### 11. exec format error

通常是镜像架构与宿主机架构不匹配，例如在 amd64 机器上运行 arm64 镜像。

排查：

```bash
docker image inspect IMAGE --format '{{.Architecture}}/{{.Os}}'
```

修复：

```bash
docker run --platform linux/amd64 IMAGE
docker buildx build --platform linux/amd64 -t IMAGE .
```

### 12. Compose 环境变量没有生效

注意三类变量不同：

- `.env` 默认用于 Compose 文件变量替换。
- `env_file` 把文件内容注入容器环境。
- `environment` 直接声明容器环境变量。

验证：

```bash
docker compose config
docker compose exec SERVICE env
```

修改后通常需要重建或重启：

```bash
docker compose up -d --force-recreate
```

### 13. depends_on 后应用仍然连不上数据库

`depends_on` 只保证启动顺序，不保证数据库已经接受连接。

修复方向：

- 应用增加连接重试。
- 数据库服务配置 `healthcheck`。
- 依赖健康检查的 Compose 条件启动只适用于支持该语法的 Compose 版本。

### 14. 容器数据丢失

常见原因：

- 数据写在容器可写层，删除容器后丢失。
- 执行了 `docker compose down -v` 或 `docker volume rm`。
- 使用匿名 volume，重建后没有复用。

建议：

- 数据库和上传文件使用 named volume。
- 在 Compose 中显式声明 volume 名称。
- 清理前先 `docker volume ls` 和 `docker volume inspect`。

### 15. 镜像越来越大

优化方向：

- 使用多阶段构建。
- 合并安装和清理步骤，避免包管理缓存留在最终层。
- `.dockerignore` 排除无关文件。
- 使用更小基础镜像，但不要牺牲必要的调试与兼容性。

### 16. 容器 DNS 或外网访问失败

排查：

```bash
docker exec CONTAINER nslookup example.com
docker exec CONTAINER ping -c 1 8.8.8.8
docker network inspect NETWORK
```

常见原因：

- 公司代理或 DNS 需要配置到 Docker daemon。
- 容器网络策略限制。
- VPN 改写路由。
- Docker Desktop 网络异常，需要重启 Docker Desktop。

### 17. 什么时候用 Docker Compose

适合：

- 一个应用需要数据库、缓存、队列等多个服务。
- 开发环境需要一条命令启动。
- 需要统一环境变量、网络、volume 和健康检查。

不适合：

- 只运行一个一次性命令。
- 生产环境已经由 Kubernetes、ECS、Nomad 等平台编排。

### 18. 镜像、容器、volume、network 有什么区别

- 镜像：只读模板，来自 Dockerfile 或镜像仓库。
- 容器：镜像运行后的进程和可写层。
- volume：独立于容器生命周期的数据存储。
- network：容器之间或容器到宿主机的通信边界。

删除容器通常不删除镜像和 named volume；删除 volume 才会影响持久化数据。

## 问题模板

要求用户补充信息时，优先要这些内容：

```text
1. 操作系统和 Docker 版本：
2. 使用 docker run 还是 docker compose：
3. 启动命令或 compose.yaml：
4. Dockerfile：
5. 完整报错：
6. docker ps -a 输出：
7. docker logs --tail 200 <container> 输出：
```
