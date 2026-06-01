---
name: docker-container-usage-faq
description: Docker 容器使用、配置、部署、调试和常见问题排查技能。用于处理 Docker CLI、Dockerfile、镜像构建、容器启动、端口映射、volume/bind mount、网络、环境变量、日志、exec、docker compose、资源限制、权限、健康检查、镜像仓库、清理、启动失败、连接失败、挂载失败、permission denied、no space left、exited、端口冲突等容器问题。触发词：Docker、容器、镜像、Dockerfile、docker run、docker compose、端口映射、数据卷、容器网络、容器日志、容器启动失败、容器排障、container、image、volume、network
---

# Docker Container Usage FAQ

## 目标

使用该技能帮助用户正确使用 Docker 容器，并对常见容器问题给出可执行、低风险、可验证的诊断和修复步骤。

需要命令速查、FAQ 细节或更多问题模板时，读取 `references/docker-container-faq.md`。

## 基本原则

- 先把 Docker 问题拆成五层：Docker 引擎、镜像构建、容器进程、网络端口、存储挂载。
- 优先使用只读或低风险命令观察现场：`docker ps -a`、`docker logs`、`docker inspect`、`docker compose ps`、`docker compose logs`。
- 在解释命令时区分镜像、容器、数据卷、网络：删除容器不等于删除镜像，删除 volume 才可能删除持久化数据。
- 不要建议用户直接执行 `docker system prune -a`、`docker volume prune`、`docker compose down -v`、删除数据库 volume、`--privileged` 或挂载宿主机敏感目录，除非用户明确要求并理解风险。
- 根据用户环境调整命令写法：Windows/PowerShell 使用 `${PWD}` 或绝对路径；Linux/macOS 使用 `$(pwd)`；Compose v2 使用 `docker compose`，不要默认使用旧的 `docker-compose`。
- 涉及生产环境时，优先给出回滚、备份和验证步骤；涉及清理、重建、迁移、重启时提醒影响范围。

## 工作流程

1. 确认用户目标：运行现有镜像、编写 Dockerfile、排查启动失败、配置端口/网络、挂载文件、使用 Compose、发布镜像或清理空间。
2. 收集最小现场信息：Docker Desktop/Linux、镜像名、启动命令或 compose 文件、报错原文、`docker ps -a`、`docker logs <container>`、相关 Dockerfile。
3. 判断问题层级：
   - Docker 引擎：daemon 未启动、权限不足、Context 错误。
   - 镜像构建：Dockerfile、构建上下文、缓存、架构、依赖下载。
   - 容器进程：入口命令、环境变量、配置文件、退出码、健康检查。
   - 网络端口：`-p` 映射、监听地址、容器间 DNS、host 访问、端口占用。
   - 存储挂载：bind mount 路径、命名 volume、权限、SELinux、Windows 文件共享。
4. 给出最小修复：先用单条命令或局部配置修改验证假设，再扩展到 Dockerfile 或 Compose。
5. 最后给出验证命令：访问 URL、查看日志、检查退出码、检查端口监听、检查 volume 数据是否还在。

## 常用容器操作

运行临时命令：

```bash
docker run --rm IMAGE COMMAND
```

运行长期服务：

```bash
docker run -d --name app --restart unless-stopped -p 8080:80 IMAGE
```

进入容器排查：

```bash
docker exec -it CONTAINER sh
```

查看日志和状态：

```bash
docker ps -a
docker logs --tail 200 CONTAINER
docker inspect CONTAINER
docker stats
```

复制文件：

```bash
docker cp CONTAINER:/path/in/container ./local-path
docker cp ./local-path CONTAINER:/path/in/container
```

## Dockerfile 指导

- 使用 `.dockerignore` 排除 `node_modules`、`.git`、构建产物、日志、密钥和本地缓存。
- 固定基础镜像版本，不要在生产镜像中依赖漂移的 `latest`。
- 优先使用多阶段构建减少最终镜像体积。
- 把依赖安装层放在源码复制层之前，提高缓存命中率。
- 使用 exec form：`CMD ["node", "server.js"]`，避免 shell form 造成信号处理异常。
- 不要把密码、token、私钥写进 Dockerfile、镜像层或构建参数；改用运行时环境变量、secret 或平台密钥管理。
- 生产镜像尽量使用非 root 用户，必要时显式创建用户并设置文件权限。
- 为 Web 服务确保进程监听 `0.0.0.0`，否则端口映射后宿主机仍可能访问不到。

## 端口与网络

- `-p 8080:80` 表示宿主机 `8080` 端口转发到容器内 `80` 端口。
- 本机开发只需要本机访问时，使用 `-p 127.0.0.1:8080:80` 限制暴露范围。
- 容器内的 `localhost` 指向容器自己，不是宿主机，也不是其他容器。
- Compose 中服务之间用服务名访问，例如 `postgres:5432`、`redis:6379`。
- Docker Desktop 中容器访问宿主机可用 `host.docker.internal`；Linux 需要按版本配置 `host-gateway` 或使用宿主网络模式。
- 容器间通信优先使用自定义 bridge 网络或 Compose 默认网络，不要依赖容器 IP。

## 数据卷与文件挂载

- bind mount 适合开发时代码/配置挂载：`-v /host/path:/container/path`。
- named volume 适合数据库、上传文件、缓存等持久化数据：`-v app-data:/var/lib/app`。
- bind mount 会覆盖镜像内同路径内容；如果挂载空目录到应用目录，容器里原本的文件会被遮住。
- 数据库不要只写在容器可写层；删除容器后这部分数据很容易丢失。
- 配置文件可只读挂载：`-v ./nginx.conf:/etc/nginx/nginx.conf:ro`。
- 权限问题先确认容器内运行用户、宿主机目录所有者、UID/GID、SELinux 标记和 Windows/WSL 文件共享设置。

## Docker Compose

使用 Compose 管理多服务开发环境或有明确依赖关系的应用。默认使用 Compose v2 命令：

```bash
docker compose up -d
docker compose ps
docker compose logs -f SERVICE
docker compose exec SERVICE sh
docker compose down
```

- `depends_on` 只表达启动顺序，不等于服务已经可用；数据库等依赖应配置健康检查或应用重试。
- 通过 `env_file` 或 `environment` 注入配置，但不要把生产密钥提交到仓库。
- 对数据库、对象存储模拟器、消息队列等服务声明 named volume。
- 不要在不确认数据影响时使用 `docker compose down -v`。

## 常见问题优先级

启动失败时先看：

```bash
docker ps -a
docker logs --tail 200 CONTAINER
docker inspect --format '{{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Error}}' CONTAINER
```

访问不到服务时先看：

```bash
docker ps
docker port CONTAINER
docker logs --tail 200 CONTAINER
```

空间不足时先看：

```bash
docker system df
docker ps -a --size
docker image ls
docker volume ls
```

权限问题先看：

```bash
docker inspect --format '{{json .Mounts}}' CONTAINER
docker exec CONTAINER id
docker exec CONTAINER ls -la /path
```

## 安全与生产建议

- 生产环境避免 `--privileged`、宿主网络、挂载 Docker socket、挂载 `/`、无限制 root 容器。
- 为容器设置资源边界：`--memory`、`--cpus`、Compose 的 `mem_limit` 或部署平台对应配置。
- 为长期服务设置健康检查和重启策略：`--restart unless-stopped` 或 Compose `restart: unless-stopped`。
- 镜像发布前扫描依赖漏洞，减少不必要工具和包。
- 生产发布使用不可变 tag 或 digest，避免同一 tag 覆盖导致回滚不可预测。

## 输出格式

回答 Docker 使用问题时，优先输出：

1. 判断结论或最可能原因。
2. 可直接执行的命令或配置片段。
3. 每条命令的作用和风险。
4. 验证步骤。
5. 如果涉及数据删除、端口暴露、权限提升或生产环境，明确提醒风险并要求确认。

排障时，先给出 3-5 个最可能原因，再给出无破坏性观测命令；只有在证据足够时再建议修改或清理。
