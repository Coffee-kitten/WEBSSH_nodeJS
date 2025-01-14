const express = require("express");
const WebSocket = require("ws");
const { Client } = require("ssh2");

const app = express();
const port = 3000;

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ noServer: true });

// 当 WebSocket 客户端连接时
wss.on("connection", (ws) => {
  let sshClient;

  // 接收来自前端的连接信息
  ws.on("message", (message) => {
    const { host, port, username, password, command } = JSON.parse(message);

    if (!sshClient) {
      // 创建 SSH 连接
      sshClient = new Client();

      sshClient
        .on("ready", () => {
          console.log("SSH 连接成功");

          // 发送连接成功消息到前端
          ws.send("SSH连接成功");

          // 执行用户发送的命令
          if (command) {
            sshClient.exec(command, (err, stream) => {
              if (err) {
                ws.send(`错误: ${err.message}`);
              } else {
                stream
                  .on("data", (data) => {
                    ws.send(data.toString());
                  })
                  .on("close", () => {
                    console.log("SSH 命令执行完毕");
                  });
              }
            });
          }
        })
        .on("error", (err) => {
          // 发送连接错误信息到前端
          ws.send(`SSH连接错误: ${err.message}`);
        })
        .connect({
          host,
          port: port || 22, // 默认使用 22 端口
          username,
          password,
        });
    } else {
      // 如果已经连接，发送命令到 SSH 会话
      if (command) {
        sshClient.exec(command, (err, stream) => {
          if (err) {
            ws.send(`错误: ${err.message}`);
          } else {
            stream
              .on("data", (data) => {
                ws.send(data.toString());
              })
              .on("close", () => {
                console.log("SSH 命令执行完毕");
              });
          }
        });
      }
    }
  });

  ws.on("close", () => {
    if (sshClient) {
      sshClient.end();
    }
  });
});

// 创建 HTTP 服务器并附加 WebSocket
app.server = app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});

app.server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// 静态文件夹（包含前端网页）
app.use(express.static("public"));
