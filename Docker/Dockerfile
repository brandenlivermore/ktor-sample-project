FROM amazoncorretto:18
EXPOSE 8080:8080
RUN mkdir /app
COPY beanstalk-test.ktor-sample-all.jar /app/app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]