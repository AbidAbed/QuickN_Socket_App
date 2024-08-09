var sok = require("socket.io");
var http = require("http");
var server = http.createServer();
const axios = require("axios");

server.listen(8900, "localhost");

var io = sok(server, {
  cors: {
    origin: "*",
  },
}); // Pass the server instance to socket.io

let users = [];
let adminUsers = [];
//Adding security validation for token if user is an admin

const addAdmin = async (userId, socketId, token) => {
  try {
    const response = await axios.get(
      `http://localhost:5000/api/v1/auth/user/isAdmin?userId=${userId}`,
      {
        headers: { ...checkToken(token) },
      }
    );
    if (response.data.isAdmin)
      !adminUsers.some((admin) => admin.userId === userId) &&
        adminUsers.push({ userId, socketId });
  } catch (err) { }
};

const getAdmin = (userId) => {
  console.log("ADMIN TO FIND :", userId);
  return adminUsers.find((admin) => admin.userId === userId);
};

const removeAdmin = (socketId) => {
  adminUsers = adminUsers.filter((admin) => admin.socketId !== socketId);
};

const getAdminBySocketId = (socketId) => {
  return adminUsers.find((admin) => admin.socketId === socketId);
};

const checkToken = (token) => {
  let isTokenSent = false;

  //Checks if user is an admin or normal user
  if (token?.includes("admin")) {
    header = { admin_header: token };

    isTokenSent = true;
    return { admin_header: token };
  } else if (token?.includes("Bearer")) {
    header = { token_header: token };

    isTokenSent = true;

    return { token_header: token };
  } else {
    return isTokenSent;
  }
};

const addUser = (userId, socketId) => {
  // iterate over users array of objects to check if the incomming userId not already in the users array , then we add a new object inside the users array contains {userId , socketId}
  // users.find(user => user.userId !== userId)

  !users.some((user) => user.userId === userId) &&
    users.push({ userId, socketId });
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  console.log("USR TO FIND :", userId);
  return users.find((user) => user.userId === userId);
};

const getUserBySocketId = (socketId) => {
  return users.find((usr) => usr.socketId === socketId);
};



// enable the socket io connection , when connect
io.on("connection", (socket) => {

  socket.on(
    "getHiddenMsg",
    ({
      senderId,
      receiverId,
      text,
      file,
      convId,
      senderUsername,
      _id,
      createdAt,
      senderAvatar,
    }) => {

      const user = getUser(receiverId);

      io.to(user?.socketId).emit("getHiddenMsg", {
        senderId,
        text,
        file,
        convId,
        senderUsername,
        _id,
        senderAvatar,
        createdAt,
      });
    }
  );


  // not completed
  socket.on("forwardMsg", ({
    senderId,
    receiverId,
    message,
    convId,
    senderUsername,
    senderAvatar,
    _id,
    createdAt,
  }) => {

    const user = getUser(receiverId)

    io.to(user?.socketId).emit("getMessage", {
      convId,
      receiverId,
      senderId: senderId,
      text: message.text,
      file: message.file,
      senderUsername,
      _id: _id,
      senderAvatar,
      createdAt: createdAt,
      isForwarded: message.isForwarded
    });

  })



  socket.on(
    "announcementSign",
    ({ userId, userName, signTime, announcementId, checkedUserObjectId }) => {
      console.log(
        {
          userId,
          userName,
          signTime: new Date(signTime).getTime(),
          announcementId,
          checkedUserObjectId,
        },
        adminUsers
      );
      adminUsers.map((admin) => {
        io.to(admin?.socketId).emit("announcementSign", {
          userId,
          userName,
          signTime,
          announcementId,
          checkedUserObjectId,
        });
      });
    }
  );


  // access event from the client
  socket.on("addUser", ({ userId, token, timestamp }) => {

    console.log({ userId, token, timestamp });
    const tokenHeaderIsValid = checkToken(token);

    // axios
    //   .put(
    //     "http://localhost:5000/api/v1/auth/user/resetLastViewedConversation",
    //     {
    //       userId: getUserBySocketId(socket.id).userId,
    //     }
    //   )
    //   .then(() => {
    //     //console.log(11);
    //   })
    //   .catch((err) => {
    //     //console.log(err);
    //   });

    if (token && tokenHeaderIsValid) {
      const dataFetch = async () => {
        try {
          const response = await axios.get(
            `http://localhost:5000/api/v1/auth/getOnlineUsers/${userId}?isOnline=${true}`,
            { isOnline: true }
          );
        } catch (error) {
          //console.log(error);
        }
      };

      users.map((usr) => {
        //console.log(3333, user, memberId);
        console.log(usr, "online");
        if (usr.userId !== userId)
          io.to(usr.socketId).emit("onlineUserId", userId);
      });

      addAdmin(userId, socket.id, token);
      addUser(userId, socket.id);

      console.log(adminUsers);
      dataFetch();
      console.log(tokenHeaderIsValid);
      //////////////////////////////////////////

      // convert the code to async code try , catch
      // make same code in disconnect but "offlineUserId" , offlineUser.userId
      // const reposnse = ["12121212131"]

      // reposnse.map((id) => {
      //   const socketId = getUser(id)
      //   io.to(socketId).emit("onlineUserId" , userId)
      // })

      /////////////////////////////////////////////////////

      //If token is provided and it contains the necessary header, then PUT the request
      //console.log(
      //   new Date(timestamp).toISOString().replace("Z", "") + "+00:00"
      // );

      axios
        .put(
          "http://localhost:5000/api/v1/auth/user/lastlogintime/update",
          {
            userId: userId,
            loginTime: timestamp,
          },
          {
            headers: { ...tokenHeaderIsValid },
          }
        )
        .then((res) => {
          console.log(
            "USER CONNECTED TO SOCKET, IP = ",
            socket.handshake.address,
            ", USER_ID = ",
            userId
          );
        })
        .catch((err) => {
          //console.log("BACKEND ERROR, COULDN'T SEND REQUEST TO BACKEND");
        });

      io.emit("getUsers", users);
    } else {
      //console.log("USER IS ANAUTHRAIZED", socket.handshake.address);
      socket.disconnect();
    }

    ////console.log(userId, socket.id)
    // add a new socket io event
  });


  // send , get messages
  socket.on(
    "sendMessage",
    ({
      senderId,
      receiverId,
      text,
      file,
      convId,
      senderUsername,
      _id,
      createdAt,
      senderAvatar,
      isForwarded
    }) => {
      const user = getUser(receiverId);

      // ////console.log({
      //   user,
      //   senderId,
      //   receiverId,
      //   text,
      //   file,
      //   convId,
      //   senderUsername,
      //   _id,
      // });

      io.to(user?.socketId).emit("getMessage", {
        senderId,
        text,
        file,
        convId,
        senderUsername,
        _id,
        senderAvatar,
        isForwarded
      });
    }
  );


  socket.on(
    "messageDeleted",
    ({ message_id, conversationId, members, senderId }) => {
      ////console.log(5);
      const membersBoolMapped = members.map((member) => {
        const userReceiver = getUser(member);


        io.to(userReceiver?.socketId).emit("messageDeleted", {
          senderId,
          conversationId,
          message_id,
        });

        return true;

      });
    }
  );


  socket.on("test", (test) => {
    ////console.log(test);
  });


  socket.on("logoutUser", ({ receiverId }) => {

    const userReceiver = getUser(receiverId);

    console.log(userReceiver);
    //console.log(users);

    axios
      .delete("http://localhost:5000/api/v1/message/file/uploading/discard", {
        data: {
          userId: receiverId,
        },
      })
      .then((res) => {
        //console.log(21);
      })
      .catch((err) => {
        //console.log(err);
      });

    ``;
    const dataFetch = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/api/v1/auth/getOnlineUsers/${receiverId}?isOnline=${false}`
        );
        // response.data.map((memberId) => {
        //   const user = getUser(memberId);
        //   io.to(user.socketId).emit("offlineUserId", offlineUser.userId);
        // });
      } catch (error) {
        //console.log(error);
      }
    };

    users.map((usr) => {
      console.log(usr, "offline");
      if (
        getUserBySocketId(socket.id) !== undefined &&
        usr.userId !== getUserBySocketId(socket.id).userId
      )
        io.to(usr.socketId).emit(
          "offlineUserId",
          getUserBySocketId(socket.id).userId
        );
      return;
    });

    dataFetch();
    removeAdmin(socket.id);
    removeUser(socket.id);

    socket.to(userReceiver?.socketId).emit("logoutUser", {});

    if (userReceiver?.socketId)
      io.sockets.sockets.get(userReceiver?.socketId).disconnect();

  });


  socket.on(
    "updatedMessage",
    ({ message_id, conversationId, members, senderId, newText }) => {
      ////console.log(5);
      const membersBoolMapped = members.map((member) => {
        const userReceiver = getUser(member);

        ////console.log(userReceiver);
        io.to(userReceiver?.socketId).emit("updatedMessage", {
          senderId,
          conversationId,
          message_id,
          newText,
        });
        return true;
      });
    }
  );

  socket.on(
    "addedToGroup",
    ({ senderId, receiverId, convId, addedUsersMembersIds }) => {
      const userReceiver = getUser(receiverId);
      ////console.log(222, receiverId, userReceiver);

      io.to(userReceiver?.socketId).emit("addedToGroup", {
        senderId,
        convId,
        addedUsersMembersIds,
      });
    }
  );


  socket.on("groupIsUpdated", ({ senderId, receiverId }) => {
    const userReceiver = getUser(receiverId);
    ////console.log(receiverId,userReceiver)
    io.to(userReceiver?.socketId).emit("groupIsUpdated", {
      senderId,
    });
  });


  socket.on(
    "removedFromGroup",
    ({ senderId, receiverId, convId, removedUserId }) => {
      const userReceiver = getUser(receiverId);
      //console.log(1111, receiverId, userReceiver);
      io.to(userReceiver?.socketId).emit("removedFromGroup", {
        senderId,
        convId,
        removedUserId,
      });
    }
  );


  socket.on(
    "fileUploaded",
    ({ senderId, receiverId, isUploaded, convId, msgId }) => {
      const userReceiver = getUser(receiverId);
      //console.log(1111, receiverId, userReceiver);
      io.to(userReceiver?.socketId).emit("fileUploaded", {
        senderId,
        convId,
        isUploaded,
        msgId,
      });
    }
  );


  socket.on("startConversation", ({ senderId, receiverId, convId }) => {

    const userReceiver = getUser(receiverId);

    const userSender = getUser(senderId);

    ////console.log(3333, receiverId);
    io.to(userReceiver?.socketId).emit("startConversation", {
      senderId,
      convId,
    });
    io.to(userSender?.socketId).emit("startConversation", {
      senderId,
      convId,
    });
  });


  socket.on("broadcastAnnouncement", () => {
    io.emit("broadcastAnnouncement");
  });



  // when disconnect

  socket.on("disconnect", (d) => {

    const offlineUser = getUserBySocketId(socket.id);

    console.log(offlineUser, "BECAME OFFLINE");

    if (offlineUser) {
      //http://localhost:5000/api/v1/auth/user/resetLastViewedConversation

      axios
        .delete("http://localhost:5000/api/v1/message/file/uploading/discard", {
          data: {
            userId: getUserBySocketId(socket.id).userId,
          },
        })
        .then((res) => {
          //console.log(21);
        })
        .catch((err) => {
          //console.log(err);
        });

      ``;
      const dataFetch = async () => {
        try {
          const response = await axios.get(
            `http://localhost:5000/api/v1/auth/getOnlineUsers/${offlineUser.userId
            }?isOnline=${false}`
          );
          // response.data.map((memberId) => {
          //   const user = getUser(memberId);
          //   //console.log(user);
          //   io.to(user.socketId).emit("offlineUserId", offlineUser.userId);
          // });
        } catch (error) {
          //console.log(error);
        }
      };

      dataFetch();

      users.map((usr) => {
        console.log(usr, "offline");
        if (usr.userId !== offlineUser.userId)
          io.to(usr.socketId).emit("offlineUserId", offlineUser.userId);
      });
      //console.log(user);
      removeAdmin(socket.id);
      removeUser(socket.id);
    }

    io.emit("getUsers", users);
  });
});